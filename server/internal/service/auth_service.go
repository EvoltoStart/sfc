package service

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

type LoginResult struct {
	Token     string         `json:"token"`
	UserID    int64          `json:"userId"`
	IsNewUser bool           `json:"isNewUser"`
	RoleFlags map[string]any `json:"roleFlags"`
	Profile   ProfileView    `json:"profile"`
}

type SessionView struct {
	UserID         int64    `json:"userId"`
	Nickname       string   `json:"nickname"`
	AvatarURL      string   `json:"avatarUrl"`
	RealnameStatus string   `json:"realnameStatus"`
	DriverVerified bool     `json:"driverVerified"`
	Roles          []string `json:"roles"`
}

func (s *Service) Authenticate(token string) (*domain.User, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	session := s.store.Snapshot().Sessions[token]
	if session == nil {
		return nil, errno.ErrUserNotLogin
	}
	return s.findUserLocked(session.UserID)
}

func (s *Service) WxLogin(code string) (*LoginResult, *errno.Error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, errno.New("PARAM_INVALID", "code 涓嶈兘涓虹┖", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	wxSession, err := s.wechatMiniapp.Code2Session(context.Background(), code)
	if err != nil || wxSession == nil || strings.TrimSpace(wxSession.OpenID) == "" {
		return nil, errno.New("WECHAT_LOGIN_FAILED", "微信登录凭证校验失败", http.StatusBadRequest)
	}

	openID := strings.TrimSpace(wxSession.OpenID)
	currentTime := now()
	user, exists := s.store.Snapshot().UsersByOpenID[openID]
	if !exists {
		user = &domain.User{
			ID:             s.store.NextID("user"),
			OpenID:         openID,
			UnionID:        strings.TrimSpace(wxSession.UnionID),
			Nickname:       fmt.Sprintf("用户%d", len(s.store.Snapshot().Users)+1),
			AvatarURL:      "",
			RealnameStatus: domain.RealnameStatusUnsubmitted,
			UserStatus:     domain.UserStatusActive,
			LastLoginAt:    currentTime,
			CreatedAt:      currentTime,
		}
		s.store.Snapshot().Users[user.ID] = user
		s.store.Snapshot().UsersByOpenID[openID] = user
	} else {
		if strings.TrimSpace(wxSession.UnionID) != "" {
			user.UnionID = strings.TrimSpace(wxSession.UnionID)
		}
		user.LastLoginAt = currentTime
	}

	token := generateToken(openID, user.ID)
	s.store.Snapshot().Sessions[token] = &domain.Session{
		Token:     token,
		UserID:    user.ID,
		CreatedAt: currentTime,
	}

	result := &LoginResult{
		Token:     token,
		UserID:    user.ID,
		IsNewUser: !exists,
		RoleFlags: map[string]any{
			"passenger": true,
			"driver":    s.isDriverVerifiedLocked(user.ID),
		},
		Profile: s.buildProfileLocked(user),
	}
	return result, nil
}

func (s *Service) GetSession(userID int64) (*SessionView, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	user, appErr := s.findUserLocked(userID)
	if appErr != nil {
		return nil, appErr
	}

	return &SessionView{
		UserID:         user.ID,
		Nickname:       user.Nickname,
		AvatarURL:      user.AvatarURL,
		RealnameStatus: user.RealnameStatus,
		DriverVerified: s.isDriverVerifiedLocked(user.ID),
		Roles:          s.userRolesLocked(user.ID),
	}, nil
}

func (s *Service) Logout(token string) {
	s.store.Lock()
	defer s.store.Unlock()

	delete(s.store.Snapshot().Sessions, token)
}
