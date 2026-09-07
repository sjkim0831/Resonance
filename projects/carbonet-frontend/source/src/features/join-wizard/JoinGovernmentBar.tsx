const GOVERNMENT_MARK = "/img/egovframework/kr_gov_symbol.png";

export function JoinGovernmentBar({ en }: { en: boolean }) {
  return (
    <div className="border-b border-[var(--kr-gov-border-light)] bg-white" data-join-government-bar>
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 lg:px-8">
        <img alt={en ? "Emblem of the Republic of Korea" : "대한민국 정부 상징"} className="h-4 w-auto" src={GOVERNMENT_MARK} />
        <span className="text-[13px] font-medium text-[var(--kr-gov-text-secondary)]">
          {en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
        </span>
      </div>
    </div>
  );
}
