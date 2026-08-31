---
description: Permanent Rule for Multi-Tenant Isolation and Zero Cross-Tenant Data Leaks
alwaysApply: true
---

# Multi-Tenant Isolation Architecture Rules

## 1. Database Scoping
* **Every read query** across exams, questions, users/students, video classes, learning documents, announcements, test attempts, results, and audit logs MUST be scoped through `build_tenant_filter(tenant_id)`.
* **Every write/insert** MUST stamp `"tenantId": tenant_id`.
* For student endpoints (`/answerer/*`), resolve the student's `tenantId` from their user record (`db.users.find_one({"userId": user_id})`) or `get_request_tenant_id(user_doc)`.

## 2. Dynamic Watermarking
* Watermarks MUST ALWAYS render the active organization name (`tenant.brandTitle` or `tenant.name` from `TenantContext` / `sessionStorage.getItem('tenant_info')`), never a hardcoded default.
* The watermark MUST only be enabled on sensitive content areas (e.g. active video playback screen, live test taking interface, solution paper) and MUST NOT blanket general catalog/navigation pages.

## 3. Backward Compatibility
* Default organization and legacy data with null/missing `tenantId` remain accessible to the primary organization via `build_tenant_filter("default")`.
* Custom tenants (e.g. `"tenant-1"`, `"tenant-2"`) are strictly isolated; neither their students nor their admins can view or modify records from any other organization.
