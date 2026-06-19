use strict;
use warnings;
my $path = "/opt/Resonance/projects/carbonet-frontend/source/src/features/emission-survey-report/EmissionSurveyReportMigrationPage.tsx";
open my $fh, '<:raw', $path or die $!;
local $/;
my $s = <$fh>;
close $fh;

$s =~ s/\.lca-sheet\{box-shadow:none!important;border:none!important;border-radius:0!important;margin:0!important;max-width:none!important;width:100%!important;box-sizing:border-box!important;padding:0!important;font-size:14px!important;line-height:1\.35!important\}/.lca-sheet{box-shadow:none!important;border:none!important;border-radius:0!important;margin:0!important;max-width:none!important;width:100%!important;box-sizing:border-box!important;padding:0!important;font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:10pt!important;font-weight:400!important;line-height:1.35!important}/;

$s =~ s/\.lca-sheet header\{min-height:25px!important;margin-bottom:8px!important\}/.lca-sheet header{min-height:25px!important;margin-bottom:8px!important}.lca-sheet header,.lca-sheet header *{font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:18pt!important;font-weight:600!important;line-height:1.2!important}/;

$s =~ s/\.lca-sheet h2\{font-size:16px!important;line-height:1\.2!important;margin-bottom:6px!important\}/.lca-sheet h2{font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:12pt!important;font-weight:600!important;line-height:1.2!important;margin-bottom:6px!important}.lca-page-2>h2{font-size:18pt!important;font-weight:600!important}/;

$s =~ s/\.lca-sheet p\{font-size:14px!important;line-height:1\.45!important\}/.lca-sheet p{font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:10pt!important;font-weight:400!important;line-height:1.45!important}/;

$s =~ s/\.lca-table\{break-inside:auto;page-break-inside:auto;font-size:14px!important;width:100%!important\}/.lca-table{break-inside:auto;page-break-inside:auto;font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:10pt!important;font-weight:400!important;width:100%!important}/;

$s =~ s/\.lca-table th\{background:#d9d9d9!important;color:#0f172a!important;padding:5px 7px!important;font-size:14px!important;line-height:1\.28!important;-webkit-print-color-adjust:exact;print-color-adjust:exact\}/.lca-table th{background:#d9d9d9!important;color:#0f172a!important;padding:5px 7px!important;font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:10pt!important;font-weight:500!important;line-height:1.28!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}/;

$s =~ s/\.lca-table td\{padding:5px 7px!important;font-size:14px!important;line-height:1\.28!important\}/.lca-table td{padding:5px 7px!important;font-family:"Pretendard GOV","Noto Sans KR",sans-serif!important;font-size:10pt!important;font-weight:400!important;line-height:1.28!important}/;

$s =~ s/(\.lca-table td\.bg-\\\[\\\#f2f2f2\\\],\.lca-table td\[class\*='bg\[\#f2f2f2\]'\]\{background:#f2f2f2!important;)/$1font-weight:500!important;/;

open my $out, '>:raw', $path or die $!;
print $out $s;
close $out;
