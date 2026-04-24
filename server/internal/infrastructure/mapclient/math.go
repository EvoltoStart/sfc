package mapclient

import "math"

func mathImplSin(v float64) float64      { return math.Sin(v) }
func mathImplCos(v float64) float64      { return math.Cos(v) }
func mathImplSqrt(v float64) float64     { return math.Sqrt(v) }
func mathImplAtan2(y, x float64) float64 { return math.Atan2(y, x) }
func mathImplRound(v float64) float64    { return math.Round(v) }
