package service

import (
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

func now() time.Time {
	return time.Now().UTC()
}

func maskMiddle(value string, prefix, suffix int) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= prefix+suffix {
		return value
	}
	return string(runes[:prefix]) + strings.Repeat("*", len(runes)-prefix-suffix) + string(runes[len(runes)-suffix:])
}

func generateToken(seed string, userID int64) string {
	sum := sha1.Sum([]byte(fmt.Sprintf("%s:%d:%d", seed, userID, time.Now().UnixNano())))
	return "tk_" + hex.EncodeToString(sum[:])
}

func generateOrderNo(prefix string, id int64) string {
	return fmt.Sprintf("%s%d%04d", prefix, time.Now().UnixMilli(), id%10000)
}

func ComputePaymentCallbackSignature(outTradeNo, payStatus, timestamp string) string {
	mac := hmac.New(sha256.New, []byte("mock-wechat-callback-secret"))
	mac.Write([]byte(outTradeNo))
	mac.Write([]byte(":"))
	mac.Write([]byte(payStatus))
	mac.Write([]byte(":"))
	mac.Write([]byte(timestamp))
	return hex.EncodeToString(mac.Sum(nil))
}

func ValidatePaymentCallbackSignature(signature, outTradeNo, payStatus, timestamp string) bool {
	signature = strings.TrimSpace(strings.ToLower(signature))
	if signature == "" || outTradeNo == "" || payStatus == "" || timestamp == "" {
		return false
	}
	expected := ComputePaymentCallbackSignature(outTradeNo, payStatus, timestamp)
	return hmac.Equal([]byte(signature), []byte(expected))
}

func parseRFC3339(value string) (time.Time, *errno.Error) {
	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, errno.New("PARAM_INVALID", "鏃堕棿鏍煎紡蹇呴』涓?RFC3339", 400)
	}
	return t.UTC(), nil
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func clamp(value, minValue, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func mathAbs(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
}

func haversineMeter(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadius = 6371000.0

	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	deltaLat := (lat2 - lat1) * math.Pi / 180
	deltaLng := (lng2 - lng1) * math.Pi / 180

	sinLat := math.Sin(deltaLat / 2)
	sinLng := math.Sin(deltaLng / 2)

	a := sinLat*sinLat + math.Cos(lat1Rad)*math.Cos(lat2Rad)*sinLng*sinLng
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadius * c
}

func pathDistanceMeter(startLat, startLng float64, waypoints []domain.Waypoint, endLat, endLng float64) int64 {
	if len(waypoints) == 0 {
		return int64(math.Round(haversineMeter(startLat, startLng, endLat, endLng)))
	}

	total := 0.0
	currentLat, currentLng := startLat, startLng
	for _, point := range waypoints {
		total += haversineMeter(currentLat, currentLng, point.Lat, point.Lng)
		currentLat, currentLng = point.Lat, point.Lng
	}
	total += haversineMeter(currentLat, currentLng, endLat, endLng)
	return int64(math.Round(total))
}

func routeDirectnessScore(startLat, startLng float64, waypoints []domain.Waypoint, endLat, endLng float64) float64 {
	total := pathDistanceMeter(startLat, startLng, waypoints, endLat, endLng)
	return directnessScoreByDistance(total, startLat, startLng, endLat, endLng)
}

func directnessScoreByDistance(totalDistanceMeter int64, startLat, startLng, endLat, endLng float64) float64 {
	total := float64(totalDistanceMeter)
	direct := haversineMeter(startLat, startLng, endLat, endLng)
	if total <= 0 || direct <= 0 {
		return 0
	}
	detourRatio := (total - direct) / direct
	score := 100 - detourRatio*40
	return math.Round(clamp(score, 0, 100)*100) / 100
}

func matchRouteScore(passengerStartLat, passengerStartLng, passengerEndLat, passengerEndLng float64, trip *domain.Trip) float64 {
	tripDistance := math.Max(float64(trip.DistanceMeter), 1000)
	startDeviation := haversineMeter(passengerStartLat, passengerStartLng, trip.StartLat, trip.StartLng) / tripDistance
	endDeviation := haversineMeter(passengerEndLat, passengerEndLng, trip.EndLat, trip.EndLng) / tripDistance
	score := 100 - (startDeviation*55+endDeviation*45)*100
	return math.Round(clamp(score, 0, 100)*100) / 100
}

func calculatePrice(distanceMeter int64) (mileageFeeFen, tollFeeFen, serviceFeeFen, totalFeeFen int64) {
	distanceKM := float64(distanceMeter) / 1000
	mileageFeeFen = int64(math.Round(distanceKM * 120))

	switch {
	case distanceMeter >= 100000:
		tollFeeFen = 1500
	case distanceMeter >= 50000:
		tollFeeFen = 800
	default:
		tollFeeFen = 0
	}

	serviceFeeFen = int64(math.Round(float64(mileageFeeFen+tollFeeFen) * 0.08))
	totalFeeFen = mileageFeeFen + tollFeeFen + serviceFeeFen
	return
}

func formatFenToYuan(amountFen int64) string {
	return fmt.Sprintf("%.2f", float64(amountFen)/100)
}

func marshalJSON(value any) string {
	bytes, _ := json.Marshal(value)
	return string(bytes)
}

func cloneInt64Slice(values []int64) []int64 {
	if len(values) == 0 {
		return nil
	}
	result := make([]int64, len(values))
	copy(result, values)
	return result
}

func paginate[T any](items []T, page, pageSize int) ([]T, int, int, int) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	total := len(items)
	start := (page - 1) * pageSize
	if start >= total {
		return []T{}, page, pageSize, total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return items[start:end], page, pageSize, total
}

func ensureSortedByIDDesc[T interface{ GetID() int64 }](items []T) {
	sort.Slice(items, func(i, j int) bool {
		return items[i].GetID() > items[j].GetID()
	})
}

func isUserOwnsVehicle(userID int64, vehicle *domain.Vehicle) bool {
	return vehicle != nil && vehicle.UserID == userID
}

func (s *Service) ensureWalletAccountLocked(userID int64) *domain.WalletAccount {
	account := s.store.Snapshot().WalletAccounts[userID]
	if account != nil {
		return account
	}
	account = &domain.WalletAccount{
		ID:                 s.store.NextID("wallet_account"),
		UserID:             userID,
		AvailableAmountFen: 0,
		FrozenAmountFen:    0,
		TotalIncomeFen:     0,
		TotalWithdrawFen:   0,
	}
	s.store.Snapshot().WalletAccounts[userID] = account
	return account
}

func (s *Service) appendWalletLedgerLocked(userID int64, bizType string, changeAmount int64, bizNo, remark string) *domain.WalletLedger {
	account := s.ensureWalletAccountLocked(userID)
	account.AvailableAmountFen += changeAmount
	if changeAmount > 0 {
		account.TotalIncomeFen += changeAmount
	}

	ledger := &domain.WalletLedger{
		ID:              s.store.NextID("wallet_ledger"),
		AccountID:       account.ID,
		BizType:         bizType,
		ChangeAmountFen: changeAmount,
		BalanceAfterFen: account.AvailableAmountFen,
		BizNo:           bizNo,
		Remark:          remark,
		CreatedAt:       now(),
	}
	s.store.Snapshot().WalletLedgers[userID] = append(s.store.Snapshot().WalletLedgers[userID], ledger)
	return ledger
}

func (s *Service) appendWalletLedgerWithBalanceLocked(userID int64, bizType string, changeAmount, balanceAfter int64, bizNo, remark string) *domain.WalletLedger {
	account := s.ensureWalletAccountLocked(userID)
	ledger := &domain.WalletLedger{
		ID:              s.store.NextID("wallet_ledger"),
		AccountID:       account.ID,
		BizType:         bizType,
		ChangeAmountFen: changeAmount,
		BalanceAfterFen: balanceAfter,
		BizNo:           bizNo,
		Remark:          remark,
		CreatedAt:       now(),
	}
	s.store.Snapshot().WalletLedgers[userID] = append(s.store.Snapshot().WalletLedgers[userID], ledger)
	return ledger
}

func (s *Service) userRolesLocked(userID int64) []string {
	roles := []string{domain.RolePassenger}
	if s.isDriverVerifiedLocked(userID) {
		roles = append(roles, domain.RoleDriver)
	}
	return roles
}

func (s *Service) isDriverVerifiedLocked(userID int64) bool {
	license := s.store.Snapshot().Licenses[userID]
	if license == nil || license.AuthStatus != domain.AuthStatusApproved {
		return false
	}
	for _, vehicle := range s.store.Snapshot().Vehicles {
		if vehicle.UserID == userID && vehicle.AuthStatus == domain.AuthStatusApproved {
			return true
		}
	}
	return false
}

func (s *Service) findUserLocked(userID int64) (*domain.User, *errno.Error) {
	user := s.store.Snapshot().Users[userID]
	if user == nil {
		return nil, errno.ErrResourceNotFound
	}
	if user.UserStatus == domain.UserStatusForbidden {
		return nil, errno.ErrUserForbidden
	}
	return user, nil
}
