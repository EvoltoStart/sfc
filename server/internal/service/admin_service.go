package service

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

type AdminLoginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type CMSBannerInput struct {
	Title    string `json:"title"`
	ImageURL string `json:"imageUrl"`
	LinkURL  string `json:"linkUrl"`
	SortNo   int    `json:"sortNo"`
	Status   string `json:"status"`
}

type CMSArticleInput struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Status  string `json:"status"`
}

func (s *Service) AuthenticateAdmin(token string) (*domain.AdminUser, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	session := s.store.Snapshot().AdminSessions[token]
	if session == nil {
		return nil, errno.ErrUserNotLogin
	}
	adminUser := s.store.Snapshot().AdminUsers[session.AdminUserID]
	if adminUser == nil || adminUser.Status != domain.AdminUserStatusActive {
		return nil, errno.ErrUserForbidden
	}
	return adminUser, nil
}

func (s *Service) AdminLogin(input AdminLoginInput) (map[string]any, *errno.Error) {
	input.Username = strings.TrimSpace(input.Username)
	input.Password = strings.TrimSpace(input.Password)
	if input.Username == "" || input.Password == "" {
		return nil, errno.ErrParamInvalid
	}

	s.store.Lock()
	defer s.store.Unlock()

	for _, adminUser := range s.store.Snapshot().AdminUsers {
		if adminUser.Username != input.Username {
			continue
		}
		if adminUser.Status != domain.AdminUserStatusActive {
			return nil, errno.ErrUserForbidden
		}
		if adminUser.Password != input.Password {
			return nil, errno.New("ADMIN_LOGIN_INVALID", "后台账号或密码错误", http.StatusUnauthorized)
		}

		token := generateToken("admin", adminUser.ID)
		nowValue := now()
		adminUser.LastLoginAt = &nowValue
		s.store.Snapshot().AdminSessions[token] = &domain.AdminSession{
			Token:       token,
			AdminUserID: adminUser.ID,
			CreatedAt:   nowValue,
		}
		return map[string]any{
			"token":       token,
			"adminUserId": adminUser.ID,
			"displayName": adminUser.DisplayName,
			"roles":       cloneStringSlice(adminUser.RoleCodes),
		}, nil
	}
	return nil, errno.New("ADMIN_LOGIN_INVALID", "后台账号或密码错误", http.StatusUnauthorized)
}

func (s *Service) GetAdminSession(adminUserID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	adminUser := s.store.Snapshot().AdminUsers[adminUserID]
	if adminUser == nil {
		return nil, errno.ErrResourceNotFound
	}
	return map[string]any{
		"adminUserId": adminUser.ID,
		"username":    adminUser.Username,
		"displayName": adminUser.DisplayName,
		"status":      adminUser.Status,
		"roles":       cloneStringSlice(adminUser.RoleCodes),
	}, nil
}

func (s *Service) GetAdminPermissions(adminUserID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	adminUser := s.store.Snapshot().AdminUsers[adminUserID]
	if adminUser == nil {
		return nil, errno.ErrResourceNotFound
	}
	return map[string]any{
		"menus":      cloneStringSlice(adminUser.MenuCodes),
		"buttons":    cloneStringSlice(adminUser.ButtonCodes),
		"dataScopes": cloneStringSlice(adminUser.DataScopes),
	}, nil
}

func (s *Service) AdminHasPermission(adminUserID int64, permissionCode string) bool {
	permissionCode = strings.TrimSpace(permissionCode)
	if permissionCode == "" {
		return true
	}
	s.store.Lock()
	defer s.store.Unlock()

	adminUser := s.store.Snapshot().AdminUsers[adminUserID]
	if adminUser == nil || adminUser.Status != domain.AdminUserStatusActive {
		return false
	}
	for _, roleCode := range adminUser.RoleCodes {
		if roleCode == "SUPER_ADMIN" {
			return true
		}
	}
	for _, buttonCode := range adminUser.ButtonCodes {
		if buttonCode == permissionCode {
			return true
		}
	}
	for _, menuCode := range adminUser.MenuCodes {
		if menuCode == permissionCode {
			return true
		}
	}
	return false
}

func (s *Service) GetAdminDashboard() (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	s.ensureAuditTasksLocked()
	today := now()
	todayOrderCount := 0
	inProgressOrderCount := 0
	exceptionOrderCount := 0
	pendingAuditCount := 0
	todaySosCount := 0
	todayIncomeFen := int64(0)
	pendingWithdrawCount := 0

	for _, order := range s.store.Snapshot().Orders {
		if sameDay(order.CreatedAt, today) {
			todayOrderCount++
		}
		if order.OrderStatus == domain.OrderStatusInProgress {
			inProgressOrderCount++
		}
		if order.ExceptionFlag || order.OrderStatus == domain.OrderStatusExceptionHandling {
			exceptionOrderCount++
		}
	}
	for _, task := range s.store.Snapshot().AuditTasks {
		if task.TaskStatus == domain.AuditTaskStatusPending {
			pendingAuditCount++
		}
	}
	for _, event := range s.store.Snapshot().SafetySOSEvents {
		if sameDay(event.CreatedAt, today) {
			todaySosCount++
		}
	}
	for _, ledgerList := range s.store.Snapshot().WalletLedgers {
		for _, ledger := range ledgerList {
			if ledger.BizType == "SETTLEMENT" && sameDay(ledger.CreatedAt, today) && ledger.ChangeAmountFen > 0 {
				todayIncomeFen += ledger.ChangeAmountFen
			}
		}
	}
	for _, withdraw := range s.store.Snapshot().Withdraws {
		if withdraw.WithdrawStatus == domain.WithdrawStatusPending {
			pendingWithdrawCount++
		}
	}

	return map[string]any{
		"todayOrderCount":      todayOrderCount,
		"inProgressOrderCount": inProgressOrderCount,
		"exceptionOrderCount":  exceptionOrderCount,
		"pendingAuditCount":    pendingAuditCount,
		"todaySosCount":        todaySosCount,
		"todayIncomeFen":       todayIncomeFen,
		"pendingWithdrawCount": pendingWithdrawCount,
		"complaintCount":       0,
	}, nil
}

func (s *Service) ListAdminAudits(taskType, taskStatus string, page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	s.ensureAuditTasksLocked()
	type item struct {
		AuditTaskID   int64     `json:"auditTaskId"`
		TaskType      string    `json:"taskType"`
		BizID         int64     `json:"bizId"`
		ApplicantName string    `json:"applicantName"`
		TaskStatus    string    `json:"taskStatus"`
		SubmittedAt   time.Time `json:"submittedAt"`
	}
	var items []item
	for _, task := range s.store.Snapshot().AuditTasks {
		if taskType != "" && task.TaskType != taskType {
			continue
		}
		if taskStatus != "" && task.TaskStatus != taskStatus {
			continue
		}
		items = append(items, item{
			AuditTaskID:   task.ID,
			TaskType:      task.TaskType,
			BizID:         task.BizID,
			ApplicantName: task.ApplicantName,
			TaskStatus:    task.TaskStatus,
			SubmittedAt:   task.SubmittedAt,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].SubmittedAt.After(items[j].SubmittedAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{
		"list":     paged,
		"page":     currentPage,
		"pageSize": currentPageSize,
		"total":    total,
	}, nil
}

func (s *Service) GetAdminAuditDetail(taskID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	s.ensureAuditTasksLocked()
	task := s.store.Snapshot().AuditTasks[taskID]
	if task == nil {
		return nil, errno.ErrResourceNotFound
	}
	return map[string]any{
		"auditTaskId":   task.ID,
		"taskType":      task.TaskType,
		"taskStatus":    task.TaskStatus,
		"applicantInfo": map[string]any{"name": task.ApplicantName},
		"materialList":  task.MaterialList,
		"historyLogs":   task.HistoryLogs,
	}, nil
}

func (s *Service) ApproveAdminAudit(adminUserID, taskID int64, remark string) (map[string]any, *errno.Error) {
	return s.updateAdminAuditStatus(adminUserID, taskID, domain.AuditTaskStatusApproved, remark)
}

func (s *Service) RejectAdminAudit(adminUserID, taskID int64, remark string) (map[string]any, *errno.Error) {
	return s.updateAdminAuditStatus(adminUserID, taskID, domain.AuditTaskStatusRejected, remark)
}

func (s *Service) updateAdminAuditStatus(adminUserID, taskID int64, status, remark string) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	s.ensureAuditTasksLocked()
	task := s.store.Snapshot().AuditTasks[taskID]
	if task == nil {
		return nil, errno.ErrResourceNotFound
	}
	adminUser := s.store.Snapshot().AdminUsers[adminUserID]
	if adminUser == nil {
		return nil, errno.ErrUserForbidden
	}
	task.TaskStatus = status
	task.Remark = strings.TrimSpace(remark)
	nowValue := now()
	task.HistoryLogs = append(task.HistoryLogs, map[string]any{
		"operatorName": adminUser.DisplayName,
		"taskStatus":   status,
		"remark":       task.Remark,
		"createdAt":    nowValue,
	})
	s.appendOperationAuditLocked(adminUserID, "ADMIN", "AUDIT_"+status, task.TaskType, task.BizID, map[string]any{
		"remark": task.Remark,
	})

	switch task.TaskType {
	case "REALNAME":
		if auth := s.store.Snapshot().RealnameAuths[task.BizID]; auth != nil {
			auth.AuthStatus = authStatusFromAuditStatus(status)
			user := s.store.Snapshot().Users[auth.UserID]
			if user != nil {
				user.RealnameStatus = auth.AuthStatus
			}
			if status == domain.AuditTaskStatusRejected {
				auth.RejectReason = task.Remark
			}
		}
	case "DRIVER_LICENSE":
		if license := s.store.Snapshot().Licenses[task.BizID]; license != nil {
			license.AuthStatus = authStatusFromAuditStatus(status)
			if status == domain.AuditTaskStatusRejected {
				license.RejectReason = task.Remark
			}
		}
	case "VEHICLE":
		if vehicle := s.store.Snapshot().Vehicles[task.BizID]; vehicle != nil {
			vehicle.AuthStatus = authStatusFromAuditStatus(status)
		}
	}

	return map[string]any{
		"success":    true,
		"taskStatus": task.TaskStatus,
	}, nil
}

func (s *Service) ListAdminOrders(orderStatus, tripStatus, driverKeyword, passengerKeyword string, abnormalFlag bool, page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		OrderID          int64  `json:"orderId"`
		OrderNo          string `json:"orderNo"`
		DriverName       string `json:"driverName"`
		PassengerName    string `json:"passengerName"`
		OrderStatus      string `json:"orderStatus"`
		RouteSummary     string `json:"routeSummary"`
		PayableAmountFen int64  `json:"payableAmountFen"`
		AbnormalFlag     bool   `json:"abnormalFlag"`
	}
	driverKeyword = strings.TrimSpace(driverKeyword)
	passengerKeyword = strings.TrimSpace(passengerKeyword)
	var items []item
	for _, order := range s.store.Snapshot().Orders {
		trip := s.store.Snapshot().Trips[order.TripID]
		driver := s.store.Snapshot().Users[order.DriverUserID]
		passenger := s.store.Snapshot().Users[order.PassengerUserID]
		if orderStatus != "" && order.OrderStatus != orderStatus {
			continue
		}
		if tripStatus != "" && trip != nil && trip.TripStatus != tripStatus {
			continue
		}
		if driverKeyword != "" && driver != nil && !strings.Contains(strings.ToLower(driver.Nickname), strings.ToLower(driverKeyword)) {
			continue
		}
		if passengerKeyword != "" && passenger != nil && !strings.Contains(strings.ToLower(passenger.Nickname), strings.ToLower(passengerKeyword)) {
			continue
		}
		if abnormalFlag && !order.ExceptionFlag {
			continue
		}
		routeSummary := ""
		if trip != nil {
			routeSummary = fmt.Sprintf("%s -> %s", trip.StartName, trip.EndName)
		}
		items = append(items, item{
			OrderID:          order.ID,
			OrderNo:          order.OrderNo,
			DriverName:       safeUserName(driver),
			PassengerName:    safeUserName(passenger),
			OrderStatus:      order.OrderStatus,
			RouteSummary:     routeSummary,
			PayableAmountFen: order.PayableAmountFen,
			AbnormalFlag:     order.ExceptionFlag,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].OrderID > items[j].OrderID })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{"list": paged, "page": currentPage, "pageSize": currentPageSize, "total": total}, nil
}

func (s *Service) GetAdminOrderDetail(orderID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	trip := s.store.Snapshot().Trips[order.TripID]
	driver := s.store.Snapshot().Users[order.DriverUserID]
	passenger := s.store.Snapshot().Users[order.PassengerUserID]
	payment := s.store.Snapshot().PaymentOrdersByOrder[order.ID]
	refund := s.store.Snapshot().RefundOrdersByOrder[order.ID]
	return map[string]any{
		"orderInfo": map[string]any{
			"orderId":     order.ID,
			"orderNo":     order.OrderNo,
			"orderStatus": order.OrderStatus,
		},
		"driverInfo":     map[string]any{"userId": driver.ID, "nickname": driver.Nickname},
		"passengerInfo":  map[string]any{"userId": passenger.ID, "nickname": passenger.Nickname},
		"routeInfo":      map[string]any{"startName": trip.StartName, "endName": trip.EndName, "departAt": trip.DepartAt},
		"statusLogs":     s.store.Snapshot().OrderLogs[order.ID],
		"priceInfo":      map[string]any{"payableAmountFen": order.PayableAmountFen, "serviceFeeFen": order.ServiceFeeFen, "distanceMeter": order.DistanceMeter},
		"paymentInfo":    payment,
		"refundInfo":     refund,
		"settlementInfo": s.store.Snapshot().SettlementsByOrder[order.ID],
		"riskInfo":       map[string]any{"abnormalFlag": order.ExceptionFlag},
		"traceSummary":   s.traceSummaryLocked(order),
	}, nil
}

func (s *Service) GetAdminTrace(orderID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	points := s.store.Snapshot().SafetyTracePoints[order.ID]
	abnormalTags := []string{}
	if order.ExceptionFlag {
		abnormalTags = append(abnormalTags, "ORDER_EXCEPTION")
	}
	return map[string]any{
		"orderId":      order.ID,
		"tracePoints":  points,
		"summary":      s.traceSummaryLocked(order),
		"abnormalTags": abnormalTags,
	}, nil
}

func (s *Service) ListAdminSOSEvents(status string, page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		SOSEventID  int64     `json:"sosEventId"`
		OrderNo     string    `json:"orderNo"`
		UserName    string    `json:"userName"`
		TriggeredAt time.Time `json:"triggeredAt"`
		EventStatus string    `json:"eventStatus"`
		HandlerName string    `json:"handlerName"`
	}
	var items []item
	for _, event := range s.store.Snapshot().SafetySOSEvents {
		if status != "" && event.EventStatus != status {
			continue
		}
		order := s.store.Snapshot().Orders[event.OrderID]
		user := s.store.Snapshot().Users[event.UserID]
		items = append(items, item{
			SOSEventID:  event.ID,
			OrderNo:     safeOrderNo(order),
			UserName:    safeUserName(user),
			TriggeredAt: event.CreatedAt,
			EventStatus: event.EventStatus,
			HandlerName: "",
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].TriggeredAt.After(items[j].TriggeredAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{"list": paged, "page": currentPage, "pageSize": currentPageSize, "total": total}, nil
}

func (s *Service) ListAdminTimeoutAlerts(page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		OrderID            int64     `json:"orderId"`
		OrderNo            string    `json:"orderNo"`
		EstimatedArrivalAt time.Time `json:"estimatedArrivalAt"`
		CurrentDelayMinute int64     `json:"currentDelayMinute"`
		AlertStatus        string    `json:"alertStatus"`
	}
	var items []item
	nowValue := now()
	for _, order := range s.store.Snapshot().Orders {
		if order.OrderStatus != domain.OrderStatusInProgress {
			continue
		}
		trip := s.store.Snapshot().Trips[order.TripID]
		eta := trip.DepartAt.Add(2 * time.Hour)
		delay := nowValue.Sub(eta)
		if delay <= 0 {
			continue
		}
		items = append(items, item{
			OrderID:            order.ID,
			OrderNo:            order.OrderNo,
			EstimatedArrivalAt: eta,
			CurrentDelayMinute: int64(delay / time.Minute),
			AlertStatus:        "ACTIVE",
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CurrentDelayMinute > items[j].CurrentDelayMinute })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{"list": paged, "page": currentPage, "pageSize": currentPageSize, "total": total}, nil
}

func (s *Service) ListAdminRouteScoreLogs(page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		SnapshotID  int64     `json:"snapshotId"`
		TripID      int64     `json:"tripId"`
		RouteScore  float64   `json:"routeScore"`
		Passed      bool      `json:"passed"`
		RuleVersion string    `json:"ruleVersion"`
		CreatedAt   time.Time `json:"createdAt"`
	}
	var items []item
	for _, snapshot := range s.store.Snapshot().RuleSnapshots {
		if snapshot.RuleType != "ROUTE_SCORE" {
			continue
		}
		items = append(items, item{
			SnapshotID:  snapshot.ID,
			TripID:      parseTripIDFromSnapshot(snapshot.SnapshotJSON),
			RouteScore:  100,
			Passed:      true,
			RuleVersion: snapshot.RuleVersion,
			CreatedAt:   snapshot.CreatedAt,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{"list": paged, "page": currentPage, "pageSize": currentPageSize, "total": total}, nil
}

func (s *Service) ListAdminFrequencyLogs(page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		LogID             int64     `json:"logId"`
		DriverUserID      int64     `json:"driverUserId"`
		CityCode          string    `json:"cityCode"`
		TripType          string    `json:"tripType"`
		CurrentDayCount   int       `json:"currentDayCount"`
		CurrentMonthCount int       `json:"currentMonthCount"`
		Passed            bool      `json:"passed"`
		CreatedAt         time.Time `json:"createdAt"`
	}
	var items []item
	for _, logItem := range s.store.Snapshot().FrequencyLogs {
		items = append(items, item{
			LogID:             logItem.ID,
			DriverUserID:      logItem.DriverUserID,
			CityCode:          logItem.CityCode,
			TripType:          logItem.TripType,
			CurrentDayCount:   logItem.CurrentDayCount,
			CurrentMonthCount: logItem.CurrentMonthCount,
			Passed:            logItem.Passed,
			CreatedAt:         logItem.CreatedAt,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{"list": paged, "page": currentPage, "pageSize": currentPageSize, "total": total}, nil
}

func (s *Service) ListAdminPricingLogs(page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		PricingLogID  int64     `json:"pricingLogId"`
		TripID        int64     `json:"tripId"`
		DistanceMeter int64     `json:"distanceMeter"`
		MileageFeeFen int64     `json:"mileageFeeFen"`
		TollFeeFen    int64     `json:"tollFeeFen"`
		ServiceFeeFen int64     `json:"serviceFeeFen"`
		CreatedAt     time.Time `json:"createdAt"`
	}
	var items []item
	for _, logItem := range s.store.Snapshot().PricingLogs {
		trip := s.store.Snapshot().Trips[logItem.TripID]
		items = append(items, item{
			PricingLogID:  logItem.ID,
			TripID:        logItem.TripID,
			DistanceMeter: trip.DistanceMeter,
			MileageFeeFen: trip.PriceTotalFen - trip.ServiceFeeFen - tollFeeByDistance(trip.DistanceMeter),
			TollFeeFen:    tollFeeByDistance(trip.DistanceMeter),
			ServiceFeeFen: trip.ServiceFeeFen,
			CreatedAt:     logItem.CreatedAt,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{"list": paged, "page": currentPage, "pageSize": currentPageSize, "total": total}, nil
}

func (s *Service) ListAdminFinanceLedger(bizType string, page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		LedgerID        int64     `json:"ledgerId"`
		BizType         string    `json:"bizType"`
		OrderNo         string    `json:"orderNo"`
		ChangeAmountFen int64     `json:"changeAmountFen"`
		OperatorName    string    `json:"operatorName"`
		CreatedAt       time.Time `json:"createdAt"`
	}
	var items []item
	for _, ledgers := range s.store.Snapshot().WalletLedgers {
		for _, ledger := range ledgers {
			if bizType != "" && ledger.BizType != bizType {
				continue
			}
			items = append(items, item{
				LedgerID:        ledger.ID,
				BizType:         ledger.BizType,
				OrderNo:         ledger.BizNo,
				ChangeAmountFen: ledger.ChangeAmountFen,
				OperatorName:    "SYSTEM",
				CreatedAt:       ledger.CreatedAt,
			})
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{"list": paged, "page": currentPage, "pageSize": currentPageSize, "total": total}, nil
}

func (s *Service) GetAdminOrderLedger(orderID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	payment := s.store.Snapshot().PaymentOrdersByOrder[order.ID]
	refund := s.store.Snapshot().RefundOrdersByOrder[order.ID]
	settlement := s.store.Snapshot().SettlementsByOrder[order.ID]
	return map[string]any{
		"orderId":         order.ID,
		"paymentFlows":    []any{payment},
		"refundFlows":     []any{refund},
		"settlementFlows": []any{settlement},
		"serviceFeeSummary": map[string]any{
			"serviceFeeFen": order.ServiceFeeFen,
		},
	}, nil
}

func (s *Service) ListAdminWithdraws(page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		WithdrawID     int64     `json:"withdrawId"`
		UserName       string    `json:"userName"`
		AmountFen      int64     `json:"amountFen"`
		WithdrawStatus string    `json:"withdrawStatus"`
		CreatedAt      time.Time `json:"createdAt"`
	}
	var items []item
	for _, withdraw := range s.store.Snapshot().Withdraws {
		user := s.store.Snapshot().Users[withdraw.UserID]
		items = append(items, item{
			WithdrawID:     withdraw.ID,
			UserName:       safeUserName(user),
			AmountFen:      withdraw.AmountFen,
			WithdrawStatus: withdraw.WithdrawStatus,
			CreatedAt:      withdraw.CreatedAt,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{"list": paged, "page": currentPage, "pageSize": currentPageSize, "total": total}, nil
}

func (s *Service) GetAdminFinanceReports() (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	income := int64(0)
	serviceFee := int64(0)
	withdrawAmount := int64(0)
	for _, settlement := range s.store.Snapshot().SettlementsByOrder {
		income += settlement.SettleAmountFen
	}
	for _, order := range s.store.Snapshot().Orders {
		serviceFee += order.ServiceFeeFen
	}
	for _, withdraw := range s.store.Snapshot().Withdraws {
		withdrawAmount += withdraw.AmountFen
	}
	return map[string]any{
		"incomeSummary":     map[string]any{"totalIncomeFen": income},
		"serviceFeeSummary": map[string]any{"totalServiceFeeFen": serviceFee},
		"orderSummary":      map[string]any{"totalOrderCount": len(s.store.Snapshot().Orders)},
		"withdrawSummary":   map[string]any{"totalWithdrawFen": withdrawAmount},
	}, nil
}

func (s *Service) ListAdminUsers(keyword string, page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		UserID         int64      `json:"userId"`
		Nickname       string     `json:"nickname"`
		MobileMasked   string     `json:"mobileMasked"`
		RealnameStatus string     `json:"realnameStatus"`
		ContactCount   int        `json:"contactCount"`
		OrderCount     int        `json:"orderCount"`
		UserStatus     string     `json:"userStatus"`
		LastLoginAt    *time.Time `json:"lastLoginAt"`
	}

	keyword = strings.TrimSpace(strings.ToLower(keyword))
	var items []item
	for _, user := range s.store.Snapshot().Users {
		if keyword != "" && !strings.Contains(strings.ToLower(user.Nickname), keyword) && !strings.Contains(strings.ToLower(user.Mobile), keyword) {
			continue
		}
		contactCount := 0
		orderCount := 0
		for _, contact := range s.store.Snapshot().Contacts {
			if contact.UserID == user.ID {
				contactCount++
			}
		}
		for _, order := range s.store.Snapshot().Orders {
			if order.DriverUserID == user.ID || order.PassengerUserID == user.ID {
				orderCount++
			}
		}
		items = append(items, item{
			UserID:         user.ID,
			Nickname:       user.Nickname,
			MobileMasked:   user.Mobile,
			RealnameStatus: user.RealnameStatus,
			ContactCount:   contactCount,
			OrderCount:     orderCount,
			UserStatus:     user.UserStatus,
			LastLoginAt:    &user.LastLoginAt,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].UserID > items[j].UserID })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{"list": paged, "page": currentPage, "pageSize": currentPageSize, "total": total}, nil
}

func (s *Service) GetAdminUserDetail(userID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	user := s.store.Snapshot().Users[userID]
	if user == nil {
		return nil, errno.ErrResourceNotFound
	}
	var contacts []map[string]any
	var vehicleCount int
	var tripCount int
	var orderCount int
	for _, contact := range s.store.Snapshot().Contacts {
		if contact.UserID != user.ID {
			continue
		}
		contacts = append(contacts, map[string]any{
			"name":      contact.Name,
			"mobile":    contact.Mobile,
			"relation":  contact.Relation,
			"isDefault": contact.IsDefault,
		})
	}
	for _, vehicle := range s.store.Snapshot().Vehicles {
		if vehicle.UserID == user.ID {
			vehicleCount++
		}
	}
	for _, trip := range s.store.Snapshot().Trips {
		if trip.DriverUserID == user.ID {
			tripCount++
		}
	}
	for _, order := range s.store.Snapshot().Orders {
		if order.DriverUserID == user.ID || order.PassengerUserID == user.ID {
			orderCount++
		}
	}
	return map[string]any{
		"userInfo": map[string]any{
			"userId":         user.ID,
			"nickname":       user.Nickname,
			"mobileMasked":   user.Mobile,
			"realnameStatus": user.RealnameStatus,
			"userStatus":     user.UserStatus,
		},
		"realnameInfo": map[string]any{
			"authStatus":   user.RealnameStatus,
			"contactCount": len(contacts),
		},
		"emergencyContacts": contacts,
		"summary": map[string]any{
			"vehicleCount": vehicleCount,
			"tripCount":    tripCount,
			"orderCount":   orderCount,
		},
		"complaintSummary": map[string]any{
			"complaintCount": 0,
		},
	}, nil
}

func (s *Service) GetAdminOpsOverview() (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type lineItem struct {
		RouteSummary  string `json:"routeSummary"`
		TripCount     int    `json:"tripCount"`
		OrderCount    int    `json:"orderCount"`
		ActiveDrivers int    `json:"activeDrivers"`
	}

	lineMap := map[string]*lineItem{}
	driverSets := map[string]map[int64]struct{}{}
	for _, trip := range s.store.Snapshot().Trips {
		key := fmt.Sprintf("%s -> %s", trip.StartName, trip.EndName)
		if lineMap[key] == nil {
			lineMap[key] = &lineItem{RouteSummary: key}
			driverSets[key] = map[int64]struct{}{}
		}
		lineMap[key].TripCount++
		driverSets[key][trip.DriverUserID] = struct{}{}
	}
	for _, order := range s.store.Snapshot().Orders {
		trip := s.store.Snapshot().Trips[order.TripID]
		if trip == nil {
			continue
		}
		key := fmt.Sprintf("%s -> %s", trip.StartName, trip.EndName)
		if lineMap[key] == nil {
			lineMap[key] = &lineItem{RouteSummary: key}
			driverSets[key] = map[int64]struct{}{}
		}
		lineMap[key].OrderCount++
	}
	var lines []lineItem
	for key, item := range lineMap {
		item.ActiveDrivers = len(driverSets[key])
		lines = append(lines, *item)
	}
	sort.Slice(lines, func(i, j int) bool { return lines[i].OrderCount > lines[j].OrderCount })

	packages := []map[string]any{
		{"packageName": "通勤包", "status": "ACTIVE", "description": "工作日早晚高峰固定通勤"},
		{"packageName": "商务包", "status": "ACTIVE", "description": "高客单价线路组合"},
		{"packageName": "夜间安心包", "status": "PLANNING", "description": "夜间安全专线策略"},
	}

	return map[string]any{
		"lines":    lines,
		"packages": packages,
	}, nil
}

func (s *Service) ListAdminAuditLogs(page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		Time      time.Time `json:"time"`
		Actor     string    `json:"actor"`
		Action    string    `json:"action"`
		RequestID string    `json:"requestId"`
		Risk      string    `json:"risk"`
	}

	var items []item
	for _, task := range s.store.Snapshot().AuditTasks {
		for index, raw := range task.HistoryLogs {
			status, _ := raw["taskStatus"].(string)
			remark, _ := raw["remark"].(string)
			createdAt, _ := raw["createdAt"].(time.Time)
			operatorName, _ := raw["operatorName"].(string)
			if operatorName == "" {
				operatorName = "SYSTEM"
			}
			risk := "LOW"
			if status == domain.AuditTaskStatusRejected {
				risk = "MEDIUM"
			}
			items = append(items, item{
				Time:      createdAt,
				Actor:     operatorName,
				Action:    fmt.Sprintf("%s / %s / %s", task.TaskType, status, remark),
				RequestID: fmt.Sprintf("audit_%d_%d", task.ID, index+1),
				Risk:      risk,
			})
		}
	}
	for _, banner := range s.store.Snapshot().CMSBanners {
		items = append(items, item{
			Time:      banner.UpdatedAt,
			Actor:     "SYSTEM",
			Action:    fmt.Sprintf("CMS_BANNER / %s / %s", banner.Title, banner.Status),
			RequestID: fmt.Sprintf("cms_banner_%d", banner.ID),
			Risk:      "LOW",
		})
	}
	for _, auditLog := range s.store.Snapshot().OperationAuditLogs {
		items = append(items, item{
			Time:      auditLog.CreatedAt,
			Actor:     auditLog.OperatorType,
			Action:    fmt.Sprintf("%s / %s / %d", auditLog.Action, auditLog.BizType, auditLog.BizID),
			RequestID: fmt.Sprintf("operation_%d", auditLog.ID),
			Risk:      "LOW",
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Time.After(items[j].Time) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{"list": paged, "page": currentPage, "pageSize": currentPageSize, "total": total}, nil
}

func (s *Service) ListCMSBanners() (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	type item struct {
		BannerID int64  `json:"bannerId"`
		Title    string `json:"title"`
		ImageURL string `json:"imageUrl"`
		LinkURL  string `json:"linkUrl"`
		SortNo   int    `json:"sortNo"`
		Status   string `json:"status"`
	}
	var items []item
	for _, banner := range s.store.Snapshot().CMSBanners {
		items = append(items, item{
			BannerID: banner.ID,
			Title:    banner.Title,
			ImageURL: banner.ImageURL,
			LinkURL:  banner.LinkURL,
			SortNo:   banner.SortNo,
			Status:   banner.Status,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].SortNo < items[j].SortNo })
	return map[string]any{"list": items}, nil
}

func (s *Service) CreateCMSBanner(input CMSBannerInput) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	banner := &domain.CMSBanner{
		ID:        s.store.NextID("cms_banner"),
		Title:     strings.TrimSpace(input.Title),
		ImageURL:  strings.TrimSpace(input.ImageURL),
		LinkURL:   strings.TrimSpace(input.LinkURL),
		SortNo:    input.SortNo,
		Status:    strings.TrimSpace(input.Status),
		UpdatedAt: now(),
	}
	s.store.Snapshot().CMSBanners[banner.ID] = banner
	return map[string]any{"bannerId": banner.ID, "success": true}, nil
}

func (s *Service) CreateCMSBannerByAdmin(adminUserID int64, input CMSBannerInput) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	banner := &domain.CMSBanner{
		ID:        s.store.NextID("cms_banner"),
		Title:     strings.TrimSpace(input.Title),
		ImageURL:  strings.TrimSpace(input.ImageURL),
		LinkURL:   strings.TrimSpace(input.LinkURL),
		SortNo:    input.SortNo,
		Status:    strings.TrimSpace(input.Status),
		UpdatedAt: now(),
	}
	s.store.Snapshot().CMSBanners[banner.ID] = banner
	s.appendOperationAuditLocked(adminUserID, "ADMIN", "CMS_BANNER_CREATE", "CMS_BANNER", banner.ID, map[string]any{
		"title": banner.Title,
	})
	return map[string]any{"bannerId": banner.ID, "success": true}, nil
}

func (s *Service) UpdateCMSBanner(bannerID int64, input CMSBannerInput) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	banner := s.store.Snapshot().CMSBanners[bannerID]
	if banner == nil {
		return nil, errno.ErrResourceNotFound
	}
	banner.Title = strings.TrimSpace(input.Title)
	banner.ImageURL = strings.TrimSpace(input.ImageURL)
	banner.LinkURL = strings.TrimSpace(input.LinkURL)
	banner.SortNo = input.SortNo
	banner.Status = strings.TrimSpace(input.Status)
	banner.UpdatedAt = now()
	return map[string]any{"success": true}, nil
}

func (s *Service) UpdateCMSBannerByAdmin(adminUserID, bannerID int64, input CMSBannerInput) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	banner := s.store.Snapshot().CMSBanners[bannerID]
	if banner == nil {
		return nil, errno.ErrResourceNotFound
	}
	banner.Title = strings.TrimSpace(input.Title)
	banner.ImageURL = strings.TrimSpace(input.ImageURL)
	banner.LinkURL = strings.TrimSpace(input.LinkURL)
	banner.SortNo = input.SortNo
	banner.Status = strings.TrimSpace(input.Status)
	banner.UpdatedAt = now()
	s.appendOperationAuditLocked(adminUserID, "ADMIN", "CMS_BANNER_UPDATE", "CMS_BANNER", banner.ID, map[string]any{
		"title": banner.Title,
	})
	return map[string]any{"success": true}, nil
}

func (s *Service) GetCMSArticle(articleType string) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	article := s.store.Snapshot().CMSArticles[articleType]
	if article == nil {
		return nil, errno.ErrResourceNotFound
	}
	return map[string]any{
		"articleId": article.ID,
		"title":     article.Title,
		"content":   article.Content,
		"status":    article.Status,
		"updatedAt": article.UpdatedAt,
	}, nil
}

func (s *Service) UpdateCMSArticle(articleType string, input CMSArticleInput) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	article := s.store.Snapshot().CMSArticles[articleType]
	if article == nil {
		article = &domain.CMSArticle{ID: s.store.NextID("cms_article"), Type: articleType}
		s.store.Snapshot().CMSArticles[articleType] = article
	}
	article.Title = strings.TrimSpace(input.Title)
	article.Content = strings.TrimSpace(input.Content)
	article.Status = strings.TrimSpace(input.Status)
	article.UpdatedAt = now()
	return map[string]any{"success": true}, nil
}

func (s *Service) UpdateCMSArticleByAdmin(adminUserID int64, articleType string, input CMSArticleInput) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	article := s.store.Snapshot().CMSArticles[articleType]
	if article == nil {
		article = &domain.CMSArticle{ID: s.store.NextID("cms_article"), Type: articleType}
		s.store.Snapshot().CMSArticles[articleType] = article
	}
	article.Title = strings.TrimSpace(input.Title)
	article.Content = strings.TrimSpace(input.Content)
	article.Status = strings.TrimSpace(input.Status)
	article.UpdatedAt = now()
	s.appendOperationAuditLocked(adminUserID, "ADMIN", "CMS_ARTICLE_UPDATE", "CMS_ARTICLE", article.ID, map[string]any{
		"articleType": articleType,
		"title":       article.Title,
	})
	return map[string]any{"success": true}, nil
}

func (s *Service) ensureAuditTasksLocked() {
	for userID, auth := range s.store.Snapshot().RealnameAuths {
		s.ensureAuditTaskLocked("REALNAME", userID, auth.ID, auth.AuthStatus, nil)
	}
	for userID, license := range s.store.Snapshot().Licenses {
		s.ensureAuditTaskLocked("DRIVER_LICENSE", userID, license.ID, license.AuthStatus, []map[string]any{{"label": "驾驶证", "imageUrl": license.ImageURL}})
	}
	for _, vehicle := range s.store.Snapshot().Vehicles {
		s.ensureAuditTaskLocked("VEHICLE", vehicle.UserID, vehicle.ID, vehicle.AuthStatus, []map[string]any{{"label": "车辆图", "imageUrl": vehicle.VehicleImageURL}})
	}
}

func (s *Service) ensureAuditTaskLocked(taskType string, userID, bizID int64, authStatus string, materials []map[string]any) {
	for _, task := range s.store.Snapshot().AuditTasks {
		if task.TaskType == taskType && task.BizID == bizID {
			return
		}
	}
	taskStatus := domain.AuditTaskStatusPending
	switch authStatus {
	case domain.AuthStatusApproved:
		taskStatus = domain.AuditTaskStatusApproved
	case domain.AuthStatusRejected:
		taskStatus = domain.AuditTaskStatusRejected
	}
	user := s.store.Snapshot().Users[userID]
	task := &domain.AuditTask{
		ID:            s.store.NextID("audit_task"),
		TaskType:      taskType,
		BizID:         bizID,
		ApplicantName: safeUserName(user),
		TaskStatus:    taskStatus,
		SubmittedAt:   now(),
		MaterialList:  materials,
		HistoryLogs: []map[string]any{
			{"taskStatus": taskStatus, "remark": "系统初始化审核任务", "createdAt": now()},
		},
	}
	s.store.Snapshot().AuditTasks[task.ID] = task
}

func (s *Service) appendOperationAuditLocked(operatorID int64, operatorType, action, bizType string, bizID int64, extra map[string]any) {
	logItem := &domain.OperationAuditLog{
		ID:           s.store.NextID("operation_audit_log"),
		OperatorID:   operatorID,
		OperatorType: operatorType,
		Action:       action,
		BizType:      bizType,
		BizID:        bizID,
		Extra:        extra,
		CreatedAt:    now(),
	}
	s.store.Snapshot().OperationAuditLogs[logItem.ID] = logItem
}

func authStatusFromAuditStatus(status string) string {
	switch status {
	case domain.AuditTaskStatusApproved:
		return domain.AuthStatusApproved
	case domain.AuditTaskStatusRejected:
		return domain.AuthStatusRejected
	default:
		return domain.AuthStatusPending
	}
}

func safeUserName(user *domain.User) string {
	if user == nil {
		return ""
	}
	return user.Nickname
}

func safeOrderNo(order *domain.RideOrder) string {
	if order == nil {
		return ""
	}
	return order.OrderNo
}

func parseTripIDFromSnapshot(snapshot string) int64 {
	return 0
}

func tollFeeByDistance(distanceMeter int64) int64 {
	switch {
	case distanceMeter >= 100000:
		return 1500
	case distanceMeter >= 50000:
		return 800
	default:
		return 0
	}
}

func cloneStringSlice(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	items := make([]string, len(values))
	copy(items, values)
	return items
}
