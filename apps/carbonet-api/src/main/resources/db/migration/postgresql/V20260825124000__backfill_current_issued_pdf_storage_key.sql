UPDATE carbonet_report_verification_registry
   SET pdf_storage_key = 'CRN-20260825-49F028838EDF/a4564467ec63a7932f16ceb246b3466d26484b4d6ebab3b7dd11b5ffbcdef957.pdf',
       pdf_stored_at = now(),
       updated_at = now()
 WHERE certificate_id = 'CRN-20260825-49F028838EDF'
   AND pdf_sha256 = 'a4564467ec63a7932f16ceb246b3466d26484b4d6ebab3b7dd11b5ffbcdef957'
   AND pdf_size_bytes = 516093
   AND pdf_storage_key IS NULL;
