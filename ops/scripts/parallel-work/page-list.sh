#!/bin/bash
# 57개 페이지 목록 (4개씩 배정 = 16개 세션)

PAGES=(
  # 세션 1: 4개
  "emission/dashboard:Carbon Emission Dashboard:/emission/dashboard"
  "emission/lca:LCA Analysis:/emission/lca"
  "emission/lci:LCI DB Query:/emission/lci"
  "emission/reduction:Reduction Scenario:/emission/reduction"
  # 세션 2: 4개
  "emission/report_submit:Report Submit:/emission/report_submit"
  "emission/simulate:Simulation:/emission/simulate"
  "emission/validate:Validation:/emission/validate"
  "monitoring/dashboard:Monitoring Dashboard:/monitoring/dashboard"
  # 세션 3: 4개
  "monitoring/realtime:Real-time Monitoring:/monitoring/realtime"
  "monitoring/alerts:Alerts:/monitoring/alerts"
  "monitoring/statistics:ESG Statistics:/monitoring/statistics"
  "monitoring/share:Share:/monitoring/share"
  # 세션 4: 4개
  "monitoring/reduction_trend:Reduction Trend:/monitoring/reduction_trend"
  "monitoring/track:Track:/monitoring/track"
  "monitoring/export:Export:/monitoring/export"
  "co2/production_list:Production Info:/co2/production_list"
  # 세션 5: 4개
  "co2/demand_list:Demand Info:/co2/demand_list"
  "co2/integrity:Integrity:/co2/integrity"
  "co2/credit:Carbon Credit:/co2/credit"
  "co2/analysis:Quality Index:/co2/analysis"
  # 세션 6: 4개
  "co2/search:MRV Info:/co2/search"
  "edu/course_list:Course List:/edu/course_list"
  "edu/my_course:My Course:/edu/my_course"
  "edu/progress:Progress:/edu/progress"
  # 세션 7: 4개
  "edu/content:Content:/edu/content"
  "edu/course_detail:Course Detail:/edu/course_detail"
  "edu/apply:Apply:/edu/apply"
  "edu/survey:Survey:/edu/survey"
  # 세션 8: 4개
  "edu/certificate:Certificate:/edu/certificate"
  "mypage/profile:My Page:/mypage/profile"
  "mypage/email:Email Change:/mypage/email"
  "mypage/notification:Notification:/mypage/notification"
  # 세션 9: 4개
  "mypage/marketing:Marketing:/mypage/marketing"
  "mypage/company:Company:/mypage/company"
  "mypage/password:Password:/mypage/password"
  "mypage/staff:Staff:/mypage/staff"
  # 세션 10: 4개
  "support/faq:FAQ:/support/faq"
  "support/inquiry:Inquiry:/support/inquiry"
  "mtn/status:Service Status:/mtn/status"
  "mtn/version:Version:/mtn/version"
  # 세션 11: 4개
  "trade/list:Trade List:/trade/list"
  "trade/market:Trade Market:/trade/market"
  "trade/report:Trade Report:/trade/report"
  "trade/buy_request:Buy Request:/trade/buy_request"
  # 세션 12: 4개
  "trade/complete:Complete:/trade/complete"
  "trade/sell:Sell:/trade/sell"
  "trade/auto_order:Auto Order:/trade/auto_order"
  "trade/price_alert:Price Alert:/trade/price_alert"
  # 세션 13: 4개
  "payment/pay:Payment:/payment/pay"
  "payment/history:Payment History:/payment/history"
  "payment/receipt:Receipt:/payment/receipt"
  "payment/refund:Refund:/payment/refund"
  # 세션 14: 4개
  "payment/refund_account:Refund Account:/payment/refund_account"
  "payment/notify:Tax Invoice:/payment/notify"
  "payment/virtual_account:Virtual Account:/payment/virtual_account"
  "certificate/list:Certificate List:/certificate/list"
  # 세션 15: 4개
  "certificate/apply:Certificate Apply:/certificate/apply"
  "certificate/report_list:Report List:/certificate/report_list"
  "certificate/report_form:Report Form:/certificate/report_form"
  "certificate/report_edit:Report Edit:/certificate/report_edit"
)

echo "총 ${#PAGES[@]}개 페이지 준비됨"
