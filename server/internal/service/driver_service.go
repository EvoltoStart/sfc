package service

import (
	"net/http"
	"sort"
	"strings"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

type DriverProfileView struct {
	DriverStatus        string  `json:"driverStatus"`
	Rating              float64 `json:"rating"`
	CompletedOrderCount int     `json:"completedOrderCount"`
	SpecialLineStatus   string  `json:"specialLineStatus"`
	LicenseStatus       string  `json:"licenseStatus"`
}

type VehicleInput struct {
	Brand           string `json:"brand"`
	Model           string `json:"model"`
	Color           string `json:"color"`
	PlateNo         string `json:"plateNo"`
	SeatCount       int    `json:"seatCount"`
	VehicleImageURL string `json:"vehicleImageUrl"`
}

type VehicleView struct {
	ID              int64  `json:"id"`
	Brand           string `json:"brand"`
	Model           string `json:"model"`
	Color           string `json:"color"`
	PlateNoMasked   string `json:"plateNoMasked"`
	SeatCount       int    `json:"seatCount"`
	AuthStatus      string `json:"authStatus"`
	IsDefault       bool   `json:"isDefault"`
	VehicleImageURL string `json:"vehicleImageUrl,omitempty"`
}

type LicenseSubmitInput struct {
	LicenseNo  string `json:"licenseNo"`
	IssueDate  string `json:"issueDate"`
	ExpireDate string `json:"expireDate"`
	ImageURL   string `json:"imageUrl"`
}

func (s *Service) GetDriverProfile(userID int64) (*DriverProfileView, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	licenseStatus := domain.RealnameStatusUnsubmitted
	if license := s.store.Snapshot().Licenses[userID]; license != nil {
		licenseStatus = license.AuthStatus
	}
	driverStatus := domain.AuthStatusPending
	if s.isDriverVerifiedLocked(userID) {
		driverStatus = domain.AuthStatusApproved
	}

	completedCount := 0
	for _, order := range s.store.Snapshot().Orders {
		if order.DriverUserID == userID && order.OrderStatus == domain.OrderStatusCompleted {
			completedCount++
		}
	}

	return &DriverProfileView{
		DriverStatus:        driverStatus,
		Rating:              5,
		CompletedOrderCount: completedCount,
		SpecialLineStatus:   "DISABLED",
		LicenseStatus:       licenseStatus,
	}, nil
}

func (s *Service) ListVehicles(userID int64) ([]VehicleView, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	var vehicles []VehicleView
	for _, vehicle := range s.store.Snapshot().Vehicles {
		if vehicle.UserID == userID {
			vehicles = append(vehicles, VehicleView{
				ID:              vehicle.ID,
				Brand:           vehicle.Brand,
				Model:           vehicle.Model,
				Color:           vehicle.Color,
				PlateNoMasked:   vehicle.PlateNoMasked,
				SeatCount:       vehicle.SeatCount,
				AuthStatus:      vehicle.AuthStatus,
				IsDefault:       vehicle.IsDefault,
				VehicleImageURL: vehicle.VehicleImageURL,
			})
		}
	}
	sort.Slice(vehicles, func(i, j int) bool {
		if boolToInt(vehicles[i].IsDefault) == boolToInt(vehicles[j].IsDefault) {
			return vehicles[i].ID < vehicles[j].ID
		}
		return vehicles[i].IsDefault
	})
	return vehicles, nil
}

func (s *Service) CreateVehicle(userID int64, input VehicleInput) (*domain.Vehicle, *errno.Error) {
	if strings.TrimSpace(input.Brand) == "" || strings.TrimSpace(input.Model) == "" || strings.TrimSpace(input.Color) == "" || strings.TrimSpace(input.PlateNo) == "" || input.SeatCount <= 0 {
		return nil, errno.New("PARAM_INVALID", "车辆信息不完整", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	currentTime := now()
	vehicle := &domain.Vehicle{
		ID:              s.store.NextID("vehicle"),
		UserID:          userID,
		PlateNoMasked:   maskMiddle(input.PlateNo, 2, 2),
		Brand:           strings.TrimSpace(input.Brand),
		Model:           strings.TrimSpace(input.Model),
		Color:           strings.TrimSpace(input.Color),
		SeatCount:       input.SeatCount,
		AuthStatus:      domain.AuthStatusApproved,
		IsDefault:       len(s.vehiclesByUserLocked(userID)) == 0,
		VehicleImageURL: strings.TrimSpace(input.VehicleImageURL),
		CreatedAt:       currentTime,
		UpdatedAt:       currentTime,
	}
	if vehicle.IsDefault {
		for _, item := range s.store.Snapshot().Vehicles {
			if item.UserID == userID {
				item.IsDefault = false
			}
		}
		vehicle.IsDefault = true
	}
	s.store.Snapshot().Vehicles[vehicle.ID] = vehicle
	return vehicle, nil
}

func (s *Service) UpdateVehicle(userID, vehicleID int64, input VehicleInput) (*domain.Vehicle, *errno.Error) {
	if strings.TrimSpace(input.Brand) == "" || strings.TrimSpace(input.Model) == "" || strings.TrimSpace(input.Color) == "" || input.SeatCount <= 0 {
		return nil, errno.New("PARAM_INVALID", "车辆信息不完整", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	vehicle := s.store.Snapshot().Vehicles[vehicleID]
	if vehicle == nil {
		return nil, errno.ErrResourceNotFound
	}
	if vehicle.UserID != userID {
		return nil, errno.ErrUserForbidden
	}

	vehicle.Brand = strings.TrimSpace(input.Brand)
	vehicle.Model = strings.TrimSpace(input.Model)
	vehicle.Color = strings.TrimSpace(input.Color)
	vehicle.SeatCount = input.SeatCount
	if strings.TrimSpace(input.VehicleImageURL) != "" {
		vehicle.VehicleImageURL = strings.TrimSpace(input.VehicleImageURL)
	}
	vehicle.UpdatedAt = now()
	return vehicle, nil
}

func (s *Service) SetDefaultVehicle(userID, vehicleID int64) *errno.Error {
	s.store.Lock()
	defer s.store.Unlock()

	vehicle := s.store.Snapshot().Vehicles[vehicleID]
	if vehicle == nil {
		return errno.ErrResourceNotFound
	}
	if vehicle.UserID != userID {
		return errno.ErrUserForbidden
	}

	for _, item := range s.store.Snapshot().Vehicles {
		if item.UserID == userID {
			item.IsDefault = item.ID == vehicleID
		}
	}
	return nil
}

func (s *Service) vehiclesByUserLocked(userID int64) []*domain.Vehicle {
	var vehicles []*domain.Vehicle
	for _, vehicle := range s.store.Snapshot().Vehicles {
		if vehicle.UserID == userID {
			vehicles = append(vehicles, vehicle)
		}
	}
	sort.Slice(vehicles, func(i, j int) bool { return vehicles[i].ID < vehicles[j].ID })
	return vehicles
}

func (s *Service) SubmitDriverLicense(userID int64, input LicenseSubmitInput) (*domain.DriverLicense, *errno.Error) {
	if strings.TrimSpace(input.LicenseNo) == "" || strings.TrimSpace(input.IssueDate) == "" || strings.TrimSpace(input.ExpireDate) == "" || strings.TrimSpace(input.ImageURL) == "" {
		return nil, errno.New("PARAM_INVALID", "驾驶证信息不完整", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	currentTime := now()
	reviewedAt := currentTime
	license := s.store.Snapshot().Licenses[userID]
	if license == nil {
		license = &domain.DriverLicense{
			ID:     s.store.NextID("driver_license"),
			UserID: userID,
		}
		s.store.Snapshot().Licenses[userID] = license
	}
	license.LicenseNoMasked = maskMiddle(input.LicenseNo, 3, 2)
	license.IssueDate = strings.TrimSpace(input.IssueDate)
	license.ExpireDate = strings.TrimSpace(input.ExpireDate)
	license.ImageURL = strings.TrimSpace(input.ImageURL)
	license.AuthStatus = domain.AuthStatusApproved
	license.SubmittedAt = currentTime
	license.ReviewedAt = &reviewedAt
	license.RejectReason = ""
	return license, nil
}

func (s *Service) GetLicenseStatus(userID int64) (*RealnameStatusView, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	license := s.store.Snapshot().Licenses[userID]
	if license == nil {
		return &RealnameStatusView{AuthStatus: domain.RealnameStatusUnsubmitted}, nil
	}
	return &RealnameStatusView{
		AuthStatus:   license.AuthStatus,
		RejectReason: license.RejectReason,
		SubmittedAt:  &license.SubmittedAt,
		ReviewedAt:   license.ReviewedAt,
	}, nil
}
