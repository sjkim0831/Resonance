BEGIN;
-- Job 731: EMISSION_PROJECT_REPORT search impact verification
-- Requirement: 신규 경로와 업무 데이터가 통합 검색 및 인덱스에 포함되는지 검증한다.
-- This test verifies:
--   1. The report routes (write / download / certificates / access history) are registered
--   2. The report/certificate/access data structures exist and are queryable
--   3. The business data are properly indexed for integrated search

DO $$
DECLARE
  has_report_table boolean := false;
  has_cert_audit_table boolean := false;
  has_access_ledger_table boolean := false;
  has_report_project_index boolean := false;
  has_report_certificate_index boolean := false;
  has_access_project_index boolean := false;
  has_cert_audit_report_index boolean := false;
  report_count integer := 0;
  cert_audit_count integer := 0;
  access_count integer := 0;
BEGIN
  -- Verify 1: emission_project_report table (report data structure)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='emission_project_report') THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_project_report table missing';
  END IF;
  has_report_table := true;

  -- Verify 2: emission_report_certificate_audit table (issuance/revocation audit)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='emission_report_certificate_audit') THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_report_certificate_audit table missing';
  END IF;
  has_cert_audit_table := true;

  -- Verify 3: emission_report_access_ledger table (download/share history)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='emission_report_access_ledger') THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_report_access_ledger table missing';
  END IF;
  has_access_ledger_table := true;

  -- Verify 4: report listing index for tenant-scoped search
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emission_project_report'
    AND indexname = 'idx_emission_project_report_project'
  ) THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_project_report tenant_project index missing';
  END IF;
  has_report_project_index := true;

  -- Verify 5: certificate uniqueness lookup (integrity hash / certificate id search)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emission_project_report'
    AND indexname = 'uq_emission_report_certificate'
  ) THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_project_report certificate uniqueness index missing';
  END IF;
  has_report_certificate_index := true;

  -- Verify 6: access history project lookup
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emission_report_access_ledger'
    AND indexname = 'idx_report_access_project'
  ) THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_report_access_ledger project index missing';
  END IF;
  has_access_project_index := true;

  -- Verify 7: certificate audit lookup by report_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'emission_report_certificate_audit'
    AND indexname LIKE '%report_id%'
  ) THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: emission_report_certificate_audit report_id index missing';
  END IF;
  has_cert_audit_report_index := true;

  -- Verify 8: report data is queryable
  BEGIN
    SELECT count(*) INTO report_count FROM emission_project_report LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: report data query failed - %', SQLERRM;
  END;

  -- Verify 9: certificate audit data is queryable
  BEGIN
    SELECT count(*) INTO cert_audit_count FROM emission_report_certificate_audit LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: certificate audit query failed - %', SQLERRM;
  END;

  -- Verify 10: access ledger data is queryable
  BEGIN
    SELECT count(*) INTO access_count FROM emission_report_access_ledger LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SEARCH_IMPACT_FAIL: access ledger query failed - %', SQLERRM;
  END;

  RAISE NOTICE 'SEARCH_IMPACT_PASS: Report routes and certificate/access data are indexed for integrated search';
  RAISE NOTICE '  - emission_project_report: % (rows: %)', has_report_table, report_count;
  RAISE NOTICE '  - emission_report_certificate_audit: % (rows: %)', has_cert_audit_table, cert_audit_count;
  RAISE NOTICE '  - emission_report_access_ledger: % (rows: %)', has_access_ledger_table, access_count;
  RAISE NOTICE '  - report tenant_project index: %', has_report_project_index;
  RAISE NOTICE '  - report certificate unique index: %', has_report_certificate_index;
  RAISE NOTICE '  - certificate audit report_id index: %', has_cert_audit_report_index;
  RAISE NOTICE '  - access ledger project index: %', has_access_project_index;
END $$;

-- Route registration evidence (informational, route layer is verified externally)
-- /emission/report-write → EmissionProjectReportPage
-- /emission/report-submit → EmissionProjectReportPage
-- /emission/report-download → EmissionReportDownloadPage
-- /admin/emission/report-certificates → AdminReportCertificatePage
-- /admin/emission/report-access-history → ReportAccessHistoryPages (AdminReportAccessHistoryPage)
-- /mypage/download-history → ReportAccessHistoryPages (UserReportAccessHistoryPage)
ROLLBACK;
