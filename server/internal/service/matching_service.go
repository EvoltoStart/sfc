package service

import (
	"math"
	"net/http"
	"sort"
	"strings"
	"time"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

type SearchMatchesInput struct {
	StartName     string  `json:"startName"`
	StartLat      float64 `json:"startLat"`
	StartLng      float64 `json:"startLng"`
	EndName       string  `json:"endName"`
	EndLat        float64 `json:"endLat"`
	EndLng        float64 `json:"endLng"`
	DepartAt      string  `json:"departAt"`
	MinRouteScore float64 `json:"minRouteScore"`
	Page          int     `json:"page"`
	PageSize      int     `json:"pageSize"`
}

func (s *Service) SearchMatches(userID int64, input SearchMatchesInput) (map[string]any, *errno.Error) {
	if strings.TrimSpace(input.StartName) == "" || strings.TrimSpace(input.EndName) == "" {
		return nil, errno.New("PARAM_INVALID", "搜索参数不完整", http.StatusBadRequest)
	}

	departAt, appErr := parseRFC3339(input.DepartAt)
	if appErr != nil {
		return nil, appErr
	}
	if input.MinRouteScore <= 0 {
		input.MinRouteScore = s.routePassScore
	}
	pricePreview, appErr := s.PricePreview(PricePreviewInput{
		StartLat:  input.StartLat,
		StartLng:  input.StartLng,
		EndLat:    input.EndLat,
		EndLng:    input.EndLng,
		SeatCount: 1,
	})
	if appErr != nil {
		return nil, appErr
	}

	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	type matchItem struct {
		TripID          int64          `json:"tripId"`
		DriverInfo      map[string]any `json:"driverInfo"`
		DepartAt        time.Time      `json:"departAt"`
		SeatAvailable   int            `json:"seatAvailable"`
		RouteScore      float64        `json:"routeScore"`
		EstimatedFeeFen int64          `json:"estimatedFeeFen"`
		SortScore       float64        `json:"sortScore"`
	}

	var items []matchItem
	for _, trip := range s.store.Snapshot().Trips {
		if trip.TripStatus != domain.TripStatusPublished && trip.TripStatus != domain.TripStatusMatching {
			continue
		}
		if trip.SeatAvailable <= 0 || trip.DriverUserID == userID {
			continue
		}

		score := matchRouteScore(input.StartLat, input.StartLng, input.EndLat, input.EndLng, trip)
		if score < input.MinRouteScore {
			continue
		}

		timePenalty := mathAbs(float64(trip.DepartAt.Sub(departAt)) / float64(time.Hour))
		sortScore := score - timePenalty

		driver := s.store.Snapshot().Users[trip.DriverUserID]
		items = append(items, matchItem{
			TripID: trip.ID,
			DriverInfo: map[string]any{
				"userId":   driver.ID,
				"nickname": driver.Nickname,
				"rating":   5,
			},
			DepartAt:        trip.DepartAt,
			SeatAvailable:   trip.SeatAvailable,
			RouteScore:      score,
			EstimatedFeeFen: pricePreview.TotalFeeFen,
			SortScore:       math.Round(sortScore*100) / 100,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].SortScore == items[j].SortScore {
			return items[i].DepartAt.Before(items[j].DepartAt)
		}
		return items[i].SortScore > items[j].SortScore
	})

	paged, currentPage, currentPageSize, total := paginate(items, input.Page, input.PageSize)
	return map[string]any{
		"list":     paged,
		"page":     currentPage,
		"pageSize": currentPageSize,
		"total":    total,
	}, nil
}
