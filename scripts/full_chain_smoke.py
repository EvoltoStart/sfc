#!/usr/bin/env python3
"""Run the local SFC core full-chain smoke scenario.

The script assumes the backend is already running. It does not start services
or call real third-party payment/map/wechat providers.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable


CALLBACK_SECRET = b"mock-wechat-callback-secret"


class SmokeFailure(RuntimeError):
    pass


def utc_after(hours: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat().replace("+00:00", "Z")


def wechat_signature(out_trade_no: str, pay_status: str, timestamp: str) -> str:
    payload = f"{out_trade_no}:{pay_status}:{timestamp}".encode("utf-8")
    return hmac.new(CALLBACK_SECRET, payload, hashlib.sha256).hexdigest()


def scrub(value: Any) -> Any:
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, item in value.items():
            normalized = str(key).lower()
            if normalized in {"token", "authorization", "sessionkey", "session_key"}:
                result[key] = "***"
            elif normalized.endswith("token"):
                result[key] = "***"
            else:
                result[key] = scrub(item)
        return result
    if isinstance(value, list):
        return [scrub(item) for item in value]
    return value


def ensure(condition: bool, message: str) -> None:
    if not condition:
        raise SmokeFailure(message)


def extract_list(data: Any) -> list[Any]:
    if isinstance(data, dict) and isinstance(data.get("list"), list):
        return data["list"]
    return []


def preview_payload(route_payload: dict[str, Any], seat_count: int) -> dict[str, Any]:
    return {
        "startLat": route_payload["startLat"],
        "startLng": route_payload["startLng"],
        "endLat": route_payload["endLat"],
        "endLng": route_payload["endLng"],
        "waypoints": route_payload.get("waypoints", []),
        "seatCount": seat_count,
    }


class FullChainSmoke:
    def __init__(self, base_url: str, timeout: int) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.requests: list[dict[str, Any]] = []
        self.steps: list[dict[str, Any]] = []
        self.state: dict[str, Any] = {}
        self.run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

    def request_json(
        self,
        name: str,
        method: str,
        path: str,
        body: Any | None = None,
        token: str | None = None,
        headers: dict[str, str] | None = None,
        expect_success: bool = True,
    ) -> dict[str, Any]:
        url = path if path.startswith("http://") or path.startswith("https://") else self.base_url + path
        request_headers = dict(headers or {})
        data = None
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            request_headers.setdefault("Content-Type", "application/json")
        if token:
            request_headers["Authorization"] = f"Bearer {token}"

        request = urllib.request.Request(
            url=url,
            method=method.upper(),
            data=data,
            headers=request_headers,
        )
        raw = ""
        status_code = 0
        parsed: Any = None
        error_text = ""
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8", errors="replace")
                status_code = response.getcode()
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            status_code = exc.code
        except Exception as exc:  # noqa: BLE001 - smoke reports should capture exact failure entry.
            error_text = str(exc)

        if raw.strip():
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = raw

        record = {
            "name": name,
            "method": method.upper(),
            "url": url,
            "requestBody": scrub(body),
            "headers": scrub(request_headers),
            "statusCode": status_code,
            "response": scrub(parsed),
            "rawResponse": raw if status_code >= 400 else "",
        }
        if error_text:
            record["transportError"] = error_text
        self.requests.append(record)

        if error_text:
            raise SmokeFailure(f"{name}: request failed: {error_text}")
        if expect_success:
            self.assert_success(name, status_code, parsed, raw)
        return {
            "statusCode": status_code,
            "response": parsed,
            "raw": raw,
        }

    def assert_success(self, name: str, status_code: int, parsed: Any, raw: str) -> None:
        if status_code != 200:
            raise SmokeFailure(f"{name}: expected HTTP 200, got {status_code}, body={raw}")
        if not isinstance(parsed, dict) or str(parsed.get("code")) != "0":
            raise SmokeFailure(f"{name}: expected response code 0, body={raw}")

    def data(self, response: dict[str, Any]) -> Any:
        parsed = response.get("response")
        if isinstance(parsed, dict):
            return parsed.get("data")
        return None

    def step(self, name: str, action: Callable[[], dict[str, Any] | None]) -> None:
        start_index = len(self.requests)
        started = datetime.now(timezone.utc)
        try:
            details = action() or {}
            self.steps.append(
                {
                    "Name": name,
                    "Passed": True,
                    "StartedAt": started.isoformat(),
                    "FinishedAt": datetime.now(timezone.utc).isoformat(),
                    "Details": scrub(details),
                    "Requests": self.requests[start_index:],
                }
            )
        except Exception as exc:  # noqa: BLE001 - keep the smoke report actionable.
            self.steps.append(
                {
                    "Name": name,
                    "Passed": False,
                    "StartedAt": started.isoformat(),
                    "FinishedAt": datetime.now(timezone.utc).isoformat(),
                    "Error": str(exc),
                    "Requests": self.requests[start_index:],
                }
            )
            raise

    def run(self) -> None:
        depart_at = utc_after(4)
        passenger_code = f"full-chain-passenger-{self.run_id}"
        driver_code = f"full-chain-driver-{self.run_id}"
        route_payload = {
            "startName": "Beijing Chaoyang",
            "startLat": 39.9219,
            "startLng": 116.4436,
            "endName": "Tianjin Heping",
            "endLat": 39.1172,
            "endLng": 117.2000,
        }
        passenger_route_payload = {
            "startName": "Beijing Chaoyang Nearby",
            "startLat": 39.9220,
            "startLng": 116.4437,
            "endName": "Tianjin Heping Nearby",
            "endLat": 39.1171,
            "endLng": 117.2001,
        }

        self.step("后端健康检查", lambda: self._health_check())
        self.step("乘客 fake 微信登录", lambda: self._login("passenger", passenger_code))
        self.step("车主 fake 微信登录", lambda: self._login("driver", driver_code))
        self.step("车主提交驾驶证", lambda: self._submit_license())
        self.step("车主创建车辆", lambda: self._create_vehicle())
        self.step("车主发布条件确认", lambda: self._driver_profile())
        self.step("发布前价格预览", lambda: self._price_preview(route_payload))
        self.step("发布前顺路度预览", lambda: self._route_score_preview(route_payload))
        self.step("车主发布行程", lambda: self._create_trip(route_payload, depart_at))
        self.step("乘客搜索匹配", lambda: self._search_matches(passenger_route_payload, depart_at))
        self.step("乘客查看行程详情", lambda: self._trip_detail())
        self.step("乘客提交同行申请", lambda: self._join_request(passenger_route_payload))
        self.step("车主查看待处理申请", lambda: self._driver_join_requests())
        self.step("车主接受同行申请", lambda: self._accept_join_request())
        self.step("乘客查看订单列表", lambda: self._passenger_order_list())
        self.step("乘客查看订单详情", lambda: self._order_detail("订单支付前详情"))
        self.step("乘客创建支付单", lambda: self._create_payment_order())
        self.step("本地 mock 微信支付回调", lambda: self._mock_payment_callback())
        self.step("乘客回查支付状态", lambda: self._payment_status())
        self.step("乘客创建紧急联系人", lambda: self._create_emergency_contact())
        self.step("乘客读取安全配置", lambda: self._get_safety_config())
        self.step("乘客保存安全配置", lambda: self._update_safety_config())
        self.step("乘客生成安全分享链接", lambda: self._create_share_link())
        self.step("乘客上报 SOS", lambda: self._create_sos())
        self.step("乘客上传轨迹点", lambda: self._upload_trace_points())
        self.step("乘客查询轨迹摘要", lambda: self._trace_summary())
        self.step("乘客确认上车", lambda: self._confirm_board())
        self.step("乘客确认到达", lambda: self._confirm_arrival())
        self.step("车主钱包余额回查", lambda: self._wallet_account())
        self.step("车主钱包流水回查", lambda: self._wallet_ledger())
        self.step("车主提现入口验证", lambda: self._wallet_withdraw())
        self.step("后台管理员登录", lambda: self._admin_login())
        self.step("后台会话与权限核查", lambda: self._admin_session_permissions())
        self.step("后台工作台核查", lambda: self._admin_dashboard())
        self.step("后台订单列表核查", lambda: self._admin_order_list())
        self.step("后台订单详情核查", lambda: self._admin_order_detail())
        self.step("后台 SOS 列表核查", lambda: self._admin_sos_list())
        self.step("后台轨迹核查", lambda: self._admin_trace())
        self.step("后台财务流水核查", lambda: self._admin_finance_ledger())
        self.step("后台订单账务核查", lambda: self._admin_order_ledger())
        self.step("后台用户列表核查", lambda: self._admin_user_list())
        self.step("后台用户详情核查", lambda: self._admin_user_detail())
        self.step("后台审核任务核查", lambda: self._admin_audits())
        self.step("后台操作审计核查", lambda: self._admin_audit_logs())

    def _health_check(self) -> dict[str, Any]:
        data = self.data(self.request_json("healthz", "GET", "/healthz"))
        ensure(isinstance(data, dict) and data.get("status") == "ok", "healthz did not return status=ok")
        return {"status": data.get("status")}

    def _login(self, role: str, code: str) -> dict[str, Any]:
        data = self.data(self.request_json(f"login:{role}", "POST", "/api/v1/auth/wx-login", {"code": code}))
        ensure(isinstance(data, dict) and data.get("token"), f"{role} login did not return token")
        self.state[f"{role}Token"] = data["token"]
        self.state[f"{role}UserId"] = data.get("userId")
        return {"userId": data.get("userId"), "isNewUser": data.get("isNewUser")}

    def _submit_license(self) -> dict[str, Any]:
        body = {
            "licenseNo": f"LIC{self.run_id}",
            "issueDate": "2024-01-01",
            "expireDate": "2034-01-01",
            "imageUrl": "https://example.com/full-chain-license.png",
        }
        data = self.data(self.request_json("driver-license-submit", "POST", "/api/v1/driver/license/submit", body, self.state["driverToken"]))
        ensure(isinstance(data, dict) and data.get("authStatus") == "APPROVED", "driver license was not approved")
        return {"licenseId": data.get("licenseId"), "authStatus": data.get("authStatus")}

    def _create_vehicle(self) -> dict[str, Any]:
        body = {
            "brand": "BYD",
            "model": "Qin Plus",
            "color": "Black",
            "plateNo": f"FC{self.run_id[-6:]}",
            "seatCount": 4,
            "vehicleImageUrl": "https://example.com/full-chain-car.png",
        }
        data = self.data(self.request_json("driver-create-vehicle", "POST", "/api/v1/driver/vehicles", body, self.state["driverToken"]))
        ensure(isinstance(data, dict) and data.get("vehicleId"), "vehicle create did not return vehicleId")
        ensure(data.get("authStatus") == "APPROVED", "vehicle was not approved")
        self.state["vehicleId"] = data["vehicleId"]
        return {"vehicleId": data["vehicleId"], "authStatus": data.get("authStatus")}

    def _driver_profile(self) -> dict[str, Any]:
        data = self.data(self.request_json("driver-profile", "GET", "/api/v1/driver/profile", token=self.state["driverToken"]))
        ensure(isinstance(data, dict) and data.get("driverStatus") == "APPROVED", "driver is not ready to publish")
        return {"driverStatus": data.get("driverStatus"), "licenseStatus": data.get("licenseStatus")}

    def _price_preview(self, route_payload: dict[str, Any]) -> dict[str, Any]:
        body = preview_payload(route_payload, 2)
        data = self.data(self.request_json("price-preview", "POST", "/api/v1/trips/price-preview", body, self.state["driverToken"]))
        ensure(isinstance(data, dict) and int(data.get("totalFeeFen", 0)) > 0, "price preview totalFeeFen is not positive")
        self.state["previewFeeFen"] = data.get("totalFeeFen")
        return {"totalFeeFen": data.get("totalFeeFen"), "distanceMeter": data.get("distanceMeter")}

    def _route_score_preview(self, route_payload: dict[str, Any]) -> dict[str, Any]:
        body = preview_payload(route_payload, 2)
        data = self.data(self.request_json("route-score-preview", "POST", "/api/v1/trips/route-score-preview", body, self.state["driverToken"]))
        ensure(isinstance(data, dict) and data.get("passed") is True, "route score preview did not pass")
        return {"routeScore": data.get("routeScore"), "passed": data.get("passed"), "ruleSnapshotId": data.get("ruleSnapshotId")}

    def _create_trip(self, route_payload: dict[str, Any], depart_at: str) -> dict[str, Any]:
        body = {
            **route_payload,
            "vehicleId": self.state["vehicleId"],
            "departAt": depart_at,
            "seatTotal": 2,
        }
        data = self.data(self.request_json("trip-create", "POST", "/api/v1/trips", body, self.state["driverToken"]))
        ensure(isinstance(data, dict) and data.get("tripId"), "trip create did not return tripId")
        ensure(data.get("tripStatus") == "PUBLISHED", f"unexpected trip status: {data.get('tripStatus')}")
        self.state["tripId"] = data["tripId"]
        return {"tripId": data["tripId"], "tripStatus": data.get("tripStatus"), "routeScore": data.get("routeScore")}

    def _search_matches(self, route_payload: dict[str, Any], depart_at: str) -> dict[str, Any]:
        body = {**route_payload, "departAt": depart_at, "minRouteScore": 0.5, "page": 1, "pageSize": 10}
        data = self.data(self.request_json("search-matches", "POST", "/api/v1/search/matches", body, self.state["passengerToken"]))
        matches = extract_list(data)
        trip_ids = [item.get("tripId") for item in matches if isinstance(item, dict)]
        ensure(self.state["tripId"] in trip_ids, f"created trip {self.state['tripId']} was not found in matches")
        return {"total": data.get("total") if isinstance(data, dict) else None, "matchedTripId": self.state["tripId"]}

    def _trip_detail(self) -> dict[str, Any]:
        data = self.data(self.request_json("trip-detail", "GET", f"/api/v1/trips/{self.state['tripId']}", token=self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("tripId") == self.state["tripId"], "trip detail id mismatch")
        return {"tripId": data.get("tripId"), "seatAvailable": data.get("seatAvailable"), "tripStatus": data.get("tripStatus")}

    def _join_request(self, route_payload: dict[str, Any]) -> dict[str, Any]:
        body = {**route_payload, "tripId": self.state["tripId"]}
        data = self.data(self.request_json("join-request-create", "POST", "/api/v1/join-requests", body, self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("joinRequestId"), "join request did not return joinRequestId")
        ensure(data.get("requestStatus") == "PENDING_DRIVER_CONFIRM", f"unexpected join request status: {data.get('requestStatus')}")
        self.state["joinRequestId"] = data["joinRequestId"]
        return {"joinRequestId": data["joinRequestId"], "requestStatus": data.get("requestStatus")}

    def _driver_join_requests(self) -> dict[str, Any]:
        path = f"/api/v1/driver/join-requests?tripId={self.state['tripId']}&status=PENDING_DRIVER_CONFIRM&page=1&pageSize=20"
        data = self.data(self.request_json("driver-join-requests", "GET", path, token=self.state["driverToken"]))
        items = extract_list(data)
        ids = [item.get("joinRequestId") for item in items if isinstance(item, dict)]
        ensure(self.state["joinRequestId"] in ids, "pending join request was not visible to driver")
        return {"joinRequestId": self.state["joinRequestId"], "visible": True}

    def _accept_join_request(self) -> dict[str, Any]:
        path = f"/api/v1/driver/join-requests/{self.state['joinRequestId']}/accept"
        data = self.data(self.request_json("driver-accept-join-request", "POST", path, {"remark": "full chain accept"}, self.state["driverToken"]))
        ensure(isinstance(data, dict) and data.get("orderId"), "accept join request did not return orderId")
        ensure(data.get("orderStatus") == "PENDING_PASSENGER_PAY", f"unexpected order status: {data.get('orderStatus')}")
        self.state["orderId"] = data["orderId"]
        return {"orderId": data["orderId"], "orderStatus": data.get("orderStatus")}

    def _passenger_order_list(self) -> dict[str, Any]:
        data = self.data(self.request_json("passenger-order-list", "GET", "/api/v1/orders?role=passenger&page=1&pageSize=20", token=self.state["passengerToken"]))
        items = extract_list(data)
        ids = [item.get("orderId") for item in items if isinstance(item, dict)]
        ensure(self.state["orderId"] in ids, "accepted order was not visible to passenger")
        return {"orderId": self.state["orderId"], "visible": True}

    def _order_detail(self, request_name: str) -> dict[str, Any]:
        data = self.data(self.request_json(request_name, "GET", f"/api/v1/orders/{self.state['orderId']}", token=self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("orderId") == self.state["orderId"], "order detail id mismatch")
        return {"orderId": data.get("orderId"), "orderStatus": data.get("orderStatus")}

    def _create_payment_order(self) -> dict[str, Any]:
        data = self.data(self.request_json("payment-order-create", "POST", "/api/v1/payments/orders", {"orderId": self.state["orderId"]}, self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("outTradeNo"), "payment order did not return outTradeNo")
        self.state["outTradeNo"] = data["outTradeNo"]
        return {"outTradeNo": data["outTradeNo"], "payChannel": data.get("payChannel"), "paymentOrderId": data.get("paymentOrderId")}

    def _mock_payment_callback(self) -> dict[str, Any]:
        timestamp = str(int(time.time()))
        pay_status = "PAID"
        headers = {
            "X-Wechat-Timestamp": timestamp,
            "X-Wechat-Signature": wechat_signature(self.state["outTradeNo"], pay_status, timestamp),
        }
        data = self.data(
            self.request_json(
                "wechat-mock-payment-callback",
                "POST",
                "/api/v1/payments/callback/wechat",
                {"outTradeNo": self.state["outTradeNo"], "payStatus": pay_status},
                headers=headers,
            )
        )
        ensure(isinstance(data, dict) and data.get("payStatus") == "PAID", f"callback pay status was {data.get('payStatus') if isinstance(data, dict) else data}")
        return {"outTradeNo": self.state["outTradeNo"], "payStatus": data.get("payStatus")}

    def _payment_status(self) -> dict[str, Any]:
        data = self.data(self.request_json("payment-status", "GET", f"/api/v1/payments/{self.state['orderId']}/status", token=self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("payStatus") == "PAID", f"payment status was {data.get('payStatus') if isinstance(data, dict) else data}")
        return {"orderId": self.state["orderId"], "payStatus": data.get("payStatus"), "amountFen": data.get("amountFen")}

    def _create_emergency_contact(self) -> dict[str, Any]:
        body = {
            "name": "Alice",
            "mobile": "13800000000",
            "relation": "family",
            "isDefault": True,
        }
        data = self.data(self.request_json("emergency-contact-create", "POST", "/api/v1/me/emergency-contacts", body, self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("contactId"), "emergency contact did not return contactId")
        self.state["contactId"] = data["contactId"]
        return {"contactId": data["contactId"]}

    def _get_safety_config(self) -> dict[str, Any]:
        data = self.data(self.request_json("safety-config-get", "GET", "/api/v1/safety/config", token=self.state["passengerToken"]))
        ensure(isinstance(data, dict), "safety config response is not an object")
        return {"shareEnabled": data.get("shareEnabled"), "recordEnabled": data.get("recordEnabled")}

    def _update_safety_config(self) -> dict[str, Any]:
        body = {
            "shareEnabled": True,
            "defaultShareContactIds": [self.state["contactId"]],
            "recordEnabled": True,
        }
        data = self.data(self.request_json("safety-config-update", "PUT", "/api/v1/safety/config", body, self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("success") is True, "safety config update did not succeed")
        return {"success": data.get("success"), "defaultShareContactIds": [self.state["contactId"]]}

    def _create_share_link(self) -> dict[str, Any]:
        body = {"orderId": self.state["orderId"], "contactIds": [self.state["contactId"]]}
        data = self.data(self.request_json("safety-share-link-create", "POST", "/api/v1/safety/share-links", body, self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("shareUrl"), "share link response did not include shareUrl")
        self.state["shareUrl"] = data["shareUrl"]
        return {"shareUrl": data["shareUrl"], "contactIds": data.get("contactIds")}

    def _create_sos(self) -> dict[str, Any]:
        body = {
            "orderId": self.state["orderId"],
            "currentLat": 39.9220,
            "currentLng": 116.4437,
            "remark": "full chain sos",
        }
        data = self.data(self.request_json("safety-sos-create", "POST", "/api/v1/safety/sos", body, self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("sosEventId"), "sos response did not include sosEventId")
        self.state["sosEventId"] = data["sosEventId"]
        return {"sosEventId": data["sosEventId"], "eventStatus": data.get("eventStatus"), "notified": data.get("notified")}

    def _upload_trace_points(self) -> dict[str, Any]:
        base_time = datetime.now(timezone.utc)
        points = [
            {"lat": 39.9220, "lng": 116.4437, "recordedAt": base_time.isoformat().replace("+00:00", "Z")},
            {"lat": 39.7000, "lng": 116.8000, "recordedAt": (base_time + timedelta(minutes=10)).isoformat().replace("+00:00", "Z")},
            {"lat": 39.1171, "lng": 117.2001, "recordedAt": (base_time + timedelta(minutes=20)).isoformat().replace("+00:00", "Z")},
        ]
        data = self.data(
            self.request_json(
                "safety-trace-upload",
                "POST",
                "/api/v1/safety/trace-points/batch",
                {"orderId": self.state["orderId"], "points": points},
                self.state["passengerToken"],
            )
        )
        ensure(isinstance(data, dict) and int(data.get("recordedCount", 0)) == len(points), "trace upload count mismatch")
        return {"recordedCount": data.get("recordedCount")}

    def _trace_summary(self) -> dict[str, Any]:
        data = self.data(self.request_json("safety-trace-summary", "GET", f"/api/v1/safety/trace-summary/{self.state['orderId']}", token=self.state["passengerToken"]))
        ensure(isinstance(data, dict) and int(data.get("totalDistanceMeter", 0)) > 0, "trace summary totalDistanceMeter is not positive")
        return {"totalDistanceMeter": data.get("totalDistanceMeter"), "pointCount": data.get("pointCount")}

    def _confirm_board(self) -> dict[str, Any]:
        data = self.data(self.request_json("order-confirm-board", "POST", f"/api/v1/orders/{self.state['orderId']}/confirm-board", token=self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("orderStatus") == "IN_PROGRESS", f"confirm board status was {data.get('orderStatus') if isinstance(data, dict) else data}")
        return {"orderStatus": data.get("orderStatus"), "boardConfirmedAt": data.get("boardConfirmedAt")}

    def _confirm_arrival(self) -> dict[str, Any]:
        data = self.data(self.request_json("order-confirm-arrival", "POST", f"/api/v1/orders/{self.state['orderId']}/confirm-arrival", token=self.state["passengerToken"]))
        ensure(isinstance(data, dict) and data.get("orderStatus") == "COMPLETED", f"confirm arrival status was {data.get('orderStatus') if isinstance(data, dict) else data}")
        ensure(data.get("settlementTriggered") is True, "arrival confirmation did not trigger settlement")
        return {"orderStatus": data.get("orderStatus"), "settlementTriggered": data.get("settlementTriggered")}

    def _wallet_account(self) -> dict[str, Any]:
        data = self.data(self.request_json("wallet-account", "GET", "/api/v1/wallet/account", token=self.state["driverToken"]))
        ensure(isinstance(data, dict), "wallet account response is not an object")
        available = int(data.get("availableAmountFen", 0))
        total_income = int(data.get("totalIncomeFen", 0))
        ensure(available > 0 or total_income > 0, "wallet account did not receive settlement income")
        self.state["walletAvailableFen"] = available
        return {"availableAmountFen": available, "totalIncomeFen": total_income, "frozenAmountFen": data.get("frozenAmountFen")}

    def _wallet_ledger(self) -> dict[str, Any]:
        data = self.data(self.request_json("wallet-ledger", "GET", "/api/v1/wallet/ledger?page=1&pageSize=20", token=self.state["driverToken"]))
        items = extract_list(data)
        ensure(len(items) > 0, "wallet ledger is empty after settlement")
        settlement_items = [item for item in items if isinstance(item, dict) and item.get("bizType") == "SETTLEMENT"]
        ensure(len(settlement_items) > 0, "wallet settlement ledger was not found")
        return {"total": data.get("total") if isinstance(data, dict) else None, "settlementLedgerCount": len(settlement_items)}

    def _wallet_withdraw(self) -> dict[str, Any]:
        amount = min(1000, int(self.state.get("walletAvailableFen", 0)))
        ensure(amount > 0, "wallet available amount is not enough for withdraw entry check")
        body = {"amountFen": amount, "withdrawChannel": "WECHAT", "remark": "full chain withdraw entry"}
        data = self.data(self.request_json("wallet-withdraw-create", "POST", "/api/v1/wallet/withdraws", body, self.state["driverToken"]))
        ensure(isinstance(data, dict) and data.get("withdrawStatus") == "PENDING", f"withdraw status was {data.get('withdrawStatus') if isinstance(data, dict) else data}")
        return {"withdrawId": data.get("withdrawId"), "withdrawStatus": data.get("withdrawStatus"), "amountFen": amount}

    def _admin_login(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-login", "POST", "/api/v1/admin/auth/login", {"username": "admin", "password": "admin123"}))
        ensure(isinstance(data, dict) and data.get("token"), "admin login did not return token")
        self.state["adminToken"] = data["token"]
        return {"displayName": data.get("displayName"), "permissionsCount": len(data.get("permissions", [])) if isinstance(data.get("permissions"), list) else None}

    def _admin_session_permissions(self) -> dict[str, Any]:
        session = self.data(self.request_json("admin-session", "GET", "/api/v1/admin/auth/session", token=self.state["adminToken"]))
        permissions = self.data(self.request_json("admin-permissions", "GET", "/api/v1/admin/auth/permissions", token=self.state["adminToken"]))
        ensure(isinstance(session, dict), "admin session response is not an object")
        ensure(isinstance(permissions, dict), "admin permissions response is not an object")
        return {"adminUserId": session.get("adminUserId"), "permissionKeys": list(permissions.keys())}

    def _admin_dashboard(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-dashboard", "GET", "/api/v1/admin/dashboard", token=self.state["adminToken"]))
        ensure(isinstance(data, dict), "admin dashboard response is not an object")
        return {"keys": list(data.keys())}

    def _admin_order_list(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-order-list", "GET", "/api/v1/admin/orders?page=1&pageSize=50", token=self.state["adminToken"]))
        items = extract_list(data)
        ids = [item.get("orderId") for item in items if isinstance(item, dict)]
        ensure(self.state["orderId"] in ids, "full-chain order was not found in admin order list")
        return {"orderId": self.state["orderId"], "visible": True}

    def _admin_order_detail(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-order-detail", "GET", f"/api/v1/admin/orders/{self.state['orderId']}", token=self.state["adminToken"]))
        ensure(isinstance(data, dict), "admin order detail response is not an object")
        order_info = data.get("orderInfo") if isinstance(data.get("orderInfo"), dict) else {}
        ensure(order_info.get("orderId") == self.state["orderId"], "admin order detail id mismatch")
        return {"orderId": order_info.get("orderId"), "orderStatus": order_info.get("orderStatus")}

    def _admin_sos_list(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-sos-list", "GET", "/api/v1/admin/risk/sos-events?page=1&pageSize=50", token=self.state["adminToken"]))
        items = extract_list(data)
        ids = [item.get("sosEventId") for item in items if isinstance(item, dict)]
        ensure(self.state["sosEventId"] in ids, "full-chain SOS event was not found in admin risk list")
        return {"sosEventId": self.state["sosEventId"], "visible": True}

    def _admin_trace(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-trace", "GET", f"/api/v1/admin/risk/trace/{self.state['orderId']}", token=self.state["adminToken"]))
        ensure(isinstance(data, dict), "admin trace response is not an object")
        points = data.get("tracePoints")
        ensure(isinstance(points, list) and len(points) > 0, "admin trace response does not contain trace points")
        return {"orderId": self.state["orderId"], "pointCount": len(points)}

    def _admin_finance_ledger(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-finance-ledger", "GET", "/api/v1/admin/finance/ledger?page=1&pageSize=50", token=self.state["adminToken"]))
        items = extract_list(data)
        ensure(len(items) > 0, "admin finance ledger is empty")
        return {"total": data.get("total") if isinstance(data, dict) else None, "visibleRows": len(items)}

    def _admin_order_ledger(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-order-ledger", "GET", f"/api/v1/admin/finance/order-ledger/{self.state['orderId']}", token=self.state["adminToken"]))
        ensure(isinstance(data, dict), "admin order ledger response is not an object")
        return {"keys": list(data.keys())}

    def _admin_user_list(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-user-list", "GET", "/api/v1/admin/users?page=1&pageSize=100", token=self.state["adminToken"]))
        items = extract_list(data)
        ids = [item.get("userId") for item in items if isinstance(item, dict)]
        passenger_id = self.state.get("passengerUserId")
        ensure(passenger_id in ids, "full-chain passenger was not found in admin user list")
        self.state["adminUserDetailId"] = passenger_id
        return {"userId": passenger_id, "visible": True}

    def _admin_user_detail(self) -> dict[str, Any]:
        user_id = self.state["adminUserDetailId"]
        data = self.data(self.request_json("admin-user-detail", "GET", f"/api/v1/admin/users/{user_id}", token=self.state["adminToken"]))
        ensure(isinstance(data, dict), "admin user detail response is not an object")
        user_info = data.get("userInfo") if isinstance(data.get("userInfo"), dict) else {}
        ensure(user_info.get("userId") == user_id, "admin user detail id mismatch")
        return {"userId": user_id, "summary": data.get("summary")}

    def _admin_audits(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-audits", "GET", "/api/v1/admin/audits?page=1&pageSize=50", token=self.state["adminToken"]))
        items = extract_list(data)
        ensure(len(items) > 0, "admin audit task list is empty")
        return {"total": data.get("total") if isinstance(data, dict) else None, "visibleRows": len(items)}

    def _admin_audit_logs(self) -> dict[str, Any]:
        data = self.data(self.request_json("admin-audit-logs", "GET", "/api/v1/admin/audit-logs?page=1&pageSize=50", token=self.state["adminToken"]))
        items = extract_list(data)
        ensure(len(items) > 0, "admin operation audit log list is empty")
        return {"total": data.get("total") if isinstance(data, dict) else None, "visibleRows": len(items)}

    def report(self, error: str | None, report_path: Path, summary_path: Path) -> dict[str, Any]:
        passed = error is None and all(step.get("Passed") for step in self.steps)
        return {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "baseUrl": self.base_url,
            "runId": self.run_id,
            "reportPath": str(report_path),
            "summaryPath": str(summary_path),
            "scenario": {
                "Name": "核心全链路联调",
                "Passed": passed,
                "Error": error or "",
                "StepCount": len(self.steps),
                "PassedStepCount": len([step for step in self.steps if step.get("Passed")]),
                "FailedStepCount": len([step for step in self.steps if not step.get("Passed")]),
                "Steps": self.steps,
            },
            "summary": {
                "Passed": passed,
                "Covered": [
                    "healthz",
                    "fake wx login",
                    "driver license and vehicle",
                    "trip preview and publish",
                    "search, join request, accept, order",
                    "mock payment callback and paid status",
                    "safety contact, config, share link, SOS, trace",
                    "board, arrival, settlement, wallet, withdraw entry",
                    "admin dashboard, orders, risk, finance, users, audits",
                ],
                "NotCovered": [
                    "real WeChat Pay merchant callback",
                    "real WeChat mini-program runtime manual flow",
                    "real AMap provider",
                    "MySQL store",
                    "coupon marketing APIs",
                    "admin async export queue",
                    "production monitoring and deployment",
                ],
            },
        }


def write_summary(path: Path, report: dict[str, Any]) -> None:
    scenario = report["scenario"]
    lines = [
        "# 全链路联调摘要",
        "",
        f"- 生成时间：{report['generatedAt']}",
        f"- 后端地址：{report['baseUrl']}",
        f"- Passed: {str(scenario['Passed']).lower()}",
        f"- JSON 报告：{report['reportPath']}",
        "",
        "## 步骤结果",
        "",
        "| # | 步骤 | Passed | 关键信息 |",
        "|---:|---|---|---|",
    ]
    for index, step in enumerate(scenario["Steps"], start=1):
        details = step.get("Details") or {}
        if step.get("Passed"):
            detail_text = json.dumps(details, ensure_ascii=False, separators=(",", ":"))[:180]
        else:
            detail_text = (step.get("Error") or "")[:180]
        lines.append(f"| {index} | {step['Name']} | {str(step.get('Passed')).lower()} | {detail_text} |")

    lines.extend(
        [
            "",
            "## 本地边界",
            "",
            "- 本脚本使用 fake 微信登录、fake/本地地图能力和 mock 微信支付回调，只证明本地核心闭环可重复打通。",
            "- 本脚本不覆盖真实微信支付商户号、平台证书、真实退款通道、短信/订阅消息、MySQL Store、CI/CD 和生产部署。",
        ]
    )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run local SFC full-chain API smoke test.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8080", help="Backend origin, default: http://127.0.0.1:8080")
    parser.add_argument("--artifacts-dir", default="artifacts", help="Directory for JSON and Markdown reports.")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP request timeout seconds.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    artifacts_dir = Path(args.artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_path = artifacts_dir / f"full-chain-report-{timestamp}.json"
    summary_path = artifacts_dir / f"full-chain-summary-{timestamp}.md"

    runner = FullChainSmoke(args.base_url, args.timeout)
    error = None
    try:
        runner.run()
    except Exception as exc:  # noqa: BLE001 - final report should be emitted even on failure.
        error = str(exc)

    report = runner.report(error, report_path, summary_path)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    write_summary(summary_path, report)

    print(f"FULL_CHAIN_REPORT={report_path}")
    print(f"FULL_CHAIN_SUMMARY={summary_path}")
    print(f"FULL_CHAIN_PASSED={str(report['scenario']['Passed']).lower()}")
    if error:
        print(f"FULL_CHAIN_ERROR={error}", file=sys.stderr)
    return 0 if report["scenario"]["Passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
