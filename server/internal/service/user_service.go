package service

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

type ProfileView struct {
	UserID               int64  `json:"userId"`
	Nickname             string `json:"nickname"`
	AvatarURL            string `json:"avatarUrl"`
	MobileMasked         string `json:"mobileMasked"`
	RealnameStatus       string `json:"realnameStatus"`
	DriverVerified       bool   `json:"driverVerified"`
	VehicleVerifiedCount int    `json:"vehicleVerifiedCount"`
}

type RealnameStatusView struct {
	AuthStatus   string     `json:"authStatus"`
	RejectReason string     `json:"rejectReason"`
	SubmittedAt  *time.Time `json:"submittedAt"`
	ReviewedAt   *time.Time `json:"reviewedAt"`
}

type EmergencyContactInput struct {
	Name      string `json:"name"`
	Mobile    string `json:"mobile"`
	Relation  string `json:"relation"`
	IsDefault bool   `json:"isDefault"`
}

type EmergencyContactView struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	MobileMasked string `json:"mobileMasked"`
	Relation     string `json:"relation"`
	IsDefault    bool   `json:"isDefault"`
}

func (s *Service) buildProfileLocked(user *domain.User) ProfileView {
	vehicleVerifiedCount := 0
	for _, vehicle := range s.store.Snapshot().Vehicles {
		if vehicle.UserID == user.ID && vehicle.AuthStatus == domain.AuthStatusApproved {
			vehicleVerifiedCount++
		}
	}
	return ProfileView{
		UserID:               user.ID,
		Nickname:             user.Nickname,
		AvatarURL:            user.AvatarURL,
		MobileMasked:         maskMiddle(user.Mobile, 3, 4),
		RealnameStatus:       user.RealnameStatus,
		DriverVerified:       s.isDriverVerifiedLocked(user.ID),
		VehicleVerifiedCount: vehicleVerifiedCount,
	}
}

func (s *Service) GetProfile(userID int64) (*ProfileView, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	user, appErr := s.findUserLocked(userID)
	if appErr != nil {
		return nil, appErr
	}
	profile := s.buildProfileLocked(user)
	return &profile, nil
}

func (s *Service) UpdateProfile(userID int64, nickname, avatarURL string) (*ProfileView, *errno.Error) {
	if strings.TrimSpace(nickname) == "" && strings.TrimSpace(avatarURL) == "" {
		return nil, errno.New("PARAM_INVALID", "至少更新一个资料字段", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	user, appErr := s.findUserLocked(userID)
	if appErr != nil {
		return nil, appErr
	}

	if strings.TrimSpace(nickname) != "" {
		user.Nickname = strings.TrimSpace(nickname)
	}
	if strings.TrimSpace(avatarURL) != "" {
		user.AvatarURL = strings.TrimSpace(avatarURL)
	}
	profile := s.buildProfileLocked(user)
	return &profile, nil
}

func (s *Service) SubmitRealname(userID int64, realName, idCardNo string) (*RealnameStatusView, int64, *errno.Error) {
	realName = strings.TrimSpace(realName)
	idCardNo = strings.TrimSpace(idCardNo)
	if realName == "" || idCardNo == "" {
		return nil, 0, errno.New("PARAM_INVALID", "实名认证参数不能为空", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	user, appErr := s.findUserLocked(userID)
	if appErr != nil {
		return nil, 0, appErr
	}

	currentTime := now()
	auth := s.store.Snapshot().RealnameAuths[userID]
	if auth == nil {
		auth = &domain.RealnameAuth{
			ID:          s.store.NextID("realname_auth"),
			UserID:      userID,
			SubmittedAt: currentTime,
		}
		s.store.Snapshot().RealnameAuths[userID] = auth
	}
	reviewedAt := currentTime
	auth.RealName = realName
	auth.IDCardMasked = maskMiddle(idCardNo, 4, 4)
	auth.AuthStatus = domain.AuthStatusApproved
	auth.SubmittedAt = currentTime
	auth.ReviewedAt = &reviewedAt
	auth.RejectReason = ""
	user.RealnameStatus = domain.AuthStatusApproved

	return &RealnameStatusView{
		AuthStatus:   auth.AuthStatus,
		RejectReason: auth.RejectReason,
		SubmittedAt:  &auth.SubmittedAt,
		ReviewedAt:   auth.ReviewedAt,
	}, auth.ID, nil
}

func (s *Service) GetRealnameStatus(userID int64) (*RealnameStatusView, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	auth := s.store.Snapshot().RealnameAuths[userID]
	if auth == nil {
		return &RealnameStatusView{
			AuthStatus: domain.RealnameStatusUnsubmitted,
		}, nil
	}
	return &RealnameStatusView{
		AuthStatus:   auth.AuthStatus,
		RejectReason: auth.RejectReason,
		SubmittedAt:  &auth.SubmittedAt,
		ReviewedAt:   auth.ReviewedAt,
	}, nil
}

func (s *Service) ListEmergencyContacts(userID int64) ([]EmergencyContactView, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	var contacts []EmergencyContactView
	for _, contact := range s.store.Snapshot().Contacts {
		if contact.UserID == userID {
			contacts = append(contacts, EmergencyContactView{
				ID:           contact.ID,
				Name:         contact.Name,
				MobileMasked: maskMiddle(contact.Mobile, 3, 4),
				Relation:     contact.Relation,
				IsDefault:    contact.IsDefault,
			})
		}
	}
	sort.Slice(contacts, func(i, j int) bool {
		if boolToInt(contacts[i].IsDefault) == boolToInt(contacts[j].IsDefault) {
			return contacts[i].ID < contacts[j].ID
		}
		return contacts[i].IsDefault
	})
	return contacts, nil
}

func (s *Service) CreateEmergencyContact(userID int64, input EmergencyContactInput) (*domain.EmergencyContact, *errno.Error) {
	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.Mobile) == "" || strings.TrimSpace(input.Relation) == "" {
		return nil, errno.New("PARAM_INVALID", "紧急联系人信息不完整", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	currentTime := now()
	contact := &domain.EmergencyContact{
		ID:        s.store.NextID("emergency_contact"),
		UserID:    userID,
		Name:      strings.TrimSpace(input.Name),
		Mobile:    strings.TrimSpace(input.Mobile),
		Relation:  strings.TrimSpace(input.Relation),
		IsDefault: input.IsDefault,
		CreatedAt: currentTime,
		UpdatedAt: currentTime,
	}

	if len(s.contactsByUserLocked(userID)) == 0 {
		contact.IsDefault = true
	}
	if contact.IsDefault {
		for _, item := range s.store.Snapshot().Contacts {
			if item.UserID == userID {
				item.IsDefault = false
			}
		}
	}

	s.store.Snapshot().Contacts[contact.ID] = contact
	return contact, nil
}

func (s *Service) UpdateEmergencyContact(userID, contactID int64, input EmergencyContactInput) (*domain.EmergencyContact, *errno.Error) {
	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.Mobile) == "" || strings.TrimSpace(input.Relation) == "" {
		return nil, errno.New("PARAM_INVALID", "紧急联系人信息不完整", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	contact := s.store.Snapshot().Contacts[contactID]
	if contact == nil {
		return nil, errno.ErrResourceNotFound
	}
	if contact.UserID != userID {
		return nil, errno.ErrUserForbidden
	}

	contact.Name = strings.TrimSpace(input.Name)
	contact.Mobile = strings.TrimSpace(input.Mobile)
	contact.Relation = strings.TrimSpace(input.Relation)
	contact.IsDefault = input.IsDefault
	contact.UpdatedAt = now()

	if contact.IsDefault {
		for _, item := range s.store.Snapshot().Contacts {
			if item.UserID == userID && item.ID != contact.ID {
				item.IsDefault = false
			}
		}
	}

	return contact, nil
}

func (s *Service) DeleteEmergencyContact(userID, contactID int64) *errno.Error {
	s.store.Lock()
	defer s.store.Unlock()

	contact := s.store.Snapshot().Contacts[contactID]
	if contact == nil {
		return errno.ErrResourceNotFound
	}
	if contact.UserID != userID {
		return errno.ErrUserForbidden
	}

	wasDefault := contact.IsDefault
	delete(s.store.Snapshot().Contacts, contactID)
	if wasDefault {
		contacts := s.contactsByUserLocked(userID)
		if len(contacts) > 0 {
			contacts[0].IsDefault = true
		}
	}
	return nil
}

func (s *Service) contactsByUserLocked(userID int64) []*domain.EmergencyContact {
	var contacts []*domain.EmergencyContact
	for _, contact := range s.store.Snapshot().Contacts {
		if contact.UserID == userID {
			contacts = append(contacts, contact)
		}
	}
	sort.Slice(contacts, func(i, j int) bool { return contacts[i].ID < contacts[j].ID })
	return contacts
}
