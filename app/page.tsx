"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Tool = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: "급여·수당" | "회계·정산" | "물품·명단";
  href: string;
  mark: string;
  tone: string;
  features: string[];
  storageKeys: string[];
  download?: boolean;
};

const tools: Tool[] = [
  {
    id: "payroll",
    name: "공무직 보수 지급내역",
    shortName: "보수 지급",
    description: "월별 급여를 불러오고 세액 검증부터 지급내역 출력까지 한 번에 처리해요.",
    category: "급여·수당",
    href: "/tools/payroll.html",
    mark: "₩",
    tone: "violet",
    features: ["전월 급여 복사", "세액 자동계산", "엑셀 다운로드"],
    storageKeys: ["gongmujikPayroll.finalForm.v2"],
  },
  {
    id: "accounts",
    name: "기관계좌 관리시스템",
    shortName: "기관계좌",
    description: "계좌와 현금 장부를 월별로 관리하고 잔액과 증빙을 빠르게 확인해요.",
    category: "회계·정산",
    href: "/tools/accounts.html",
    mark: "▤",
    tone: "blue",
    features: ["입출금 장부", "영수증 첨부", "통합 보고서"],
    storageKeys: ["officeBudgetLedgerMultiDirectory.v1"],
  },
  {
    id: "supplies",
    name: "사무용품 주문목록",
    shortName: "사무용품",
    description: "견적 내용을 정리하고 주문 목록을 CSV·XLSX·PDF로 바로 만들어요.",
    category: "물품·명단",
    href: "/tools/supplies.html",
    mark: "□",
    tone: "orange",
    features: ["OCR 텍스트 반영", "이전 목록 불러오기", "다양한 출력"],
    storageKeys: ["officeSupplyOrderApp.savedOrders.v3"],
  },
  {
    id: "checklist",
    name: "수합명단 체크리스트",
    shortName: "수합명단",
    description: "엑셀 명단을 불러와 제출 여부를 표시하고 필요한 이름을 즉시 복사해요.",
    category: "물품·명단",
    href: "/tools/checklist.html",
    mark: "✓",
    tone: "mint",
    features: ["XLSX 열 선택", "클릭 복사", "진행상태 저장"],
    storageKeys: ["click-copy-name-list-v2", "click-copy-name-list-v1"],
  },
  {
    id: "salary-rpa",
    name: "급여 RPA",
    shortName: "급여 RPA",
    description: "급여자료를 대상 사이트에 입력하는 브라우저 확장 프로그램을 내려받아요.",
    category: "급여·수당",
    href: "/downloads/SalaryRPA_Extension.zip",
    mark: "R",
    tone: "violet",
    features: ["ZIP 다운로드", "브라우저 확장", "급여 입력 자동화"],
    storageKeys: [],
    download: true,
  },
  {
    id: "travel",
    name: "여비 정산",
    shortName: "여비 정산",
    description: "근무지 내·외 출장비를 구분해 계산하고 통합 목록과 개인별 합계를 만들어요.",
    category: "회계·정산",
    href: "/tools/travel.html",
    mark: "↗",
    tone: "cyan",
    features: ["출장내역 XLSX", "여비 자동배분", "통합 PDF"],
    storageKeys: [],
  },
  {
    id: "overtime-meals",
    name: "특근매식비 정산",
    shortName: "특근매식비",
    description: "매식 내역과 근무시간을 대조해 집행 대상을 검증하고 결과 파일을 생성해요.",
    category: "급여·수당",
    href: "/tools/overtime-meals.html",
    mark: "○",
    tone: "rose",
    features: ["근무시간표 대조", "집행대상 검증", "개인별 합계"],
    storageKeys: [],
  },
];

const categoryOptions = ["전체", "급여·수당", "회계·정산", "물품·명단"] as const;
const favoriteKey = "seomuHub.favorites.v1";
const recentKey = "seomuHub.recent.v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categoryOptions)[number]>("전체");
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [savedTools, setSavedTools] = useState<string[]>([]);
  const [today, setToday] = useState("");
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const restoreInput = useRef<HTMLInputElement>(null);

  const refreshSavedState = () => {
    const saved = tools
      .filter((tool) => tool.storageKeys.some((key) => window.localStorage.getItem(key)))
      .map((tool) => tool.id);
    setSavedTools(saved);
  };

  useEffect(() => {
    setFavorites(readJson<string[]>(favoriteKey, []));
    setRecents(readJson<string[]>(recentKey, []));
    refreshSavedState();
    setToday(
      new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(new Date()),
    );
  }, []);

  useEffect(() => {
    if (!activeTool) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveTool(null);
    };
    document.body.classList.add("workspace-open");
    window.addEventListener("keydown", close);
    return () => {
      document.body.classList.remove("workspace-open");
      window.removeEventListener("keydown", close);
      refreshSavedState();
    };
  }, [activeTool]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return tools.filter((tool) => {
      const categoryMatch = category === "전체" || tool.category === category;
      const haystack = [tool.name, tool.description, tool.category, ...tool.features]
        .join(" ")
        .toLocaleLowerCase("ko-KR");
      return categoryMatch && (!normalized || haystack.includes(normalized));
    });
  }, [category, query]);

  const recentTools = recents
    .map((id) => tools.find((tool) => tool.id === id))
    .filter((tool): tool is Tool => Boolean(tool))
    .slice(0, 3);

  const openTool = (tool: Tool) => {
    const next = [tool.id, ...recents.filter((id) => id !== tool.id)].slice(0, 6);
    setRecents(next);
    window.localStorage.setItem(recentKey, JSON.stringify(next));
    if (tool.download) {
      const anchor = document.createElement("a");
      anchor.href = tool.href;
      anchor.download = "SalaryRPA_Extension.zip";
      anchor.click();
      setToast("급여 RPA 다운로드를 시작했어요.");
      setMenuOpen(false);
      return;
    }
    setActiveTool(tool);
    setMenuOpen(false);
  };

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((favorite) => favorite !== id)
      : [...favorites, id];
    setFavorites(next);
    window.localStorage.setItem(favoriteKey, JSON.stringify(next));
    setToast(next.includes(id) ? "즐겨찾기에 추가했어요." : "즐겨찾기에서 뺐어요.");
  };

  const downloadBackup = () => {
    const data: Record<string, string> = {};
    tools.flatMap((tool) => tool.storageKeys).forEach((key) => {
      const value = window.localStorage.getItem(key);
      if (value !== null) data[key] = value;
    });
    const payload = {
      app: "서무랜드",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `서무업무_통합백업_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast(Object.keys(data).length ? "통합 백업을 저장했어요." : "저장된 자료가 없어 빈 백업을 만들었어요.");
  };

  const restoreBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        if (!["서무랜드", "서무업무 허브"].includes(payload?.app) || typeof payload?.data !== "object") {
          throw new Error("invalid");
        }
        const allowed = new Set(tools.flatMap((tool) => tool.storageKeys));
        let count = 0;
        Object.entries(payload.data).forEach(([key, value]) => {
          if (allowed.has(key) && typeof value === "string") {
            window.localStorage.setItem(key, value);
            count += 1;
          }
        });
        refreshSavedState();
        setToast(`${count}개 데이터 묶음을 복원했어요.`);
      } catch {
        setToast("허브 통합백업 파일인지 확인해 주세요.");
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`} aria-label="주 메뉴">
        <div className="brand" onClick={() => scrollTo("home")} role="button" tabIndex={0}>
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>서무랜드</strong><small>업무 허브</small></span>
        </div>

        <nav className="side-nav">
          <button className="active" onClick={() => scrollTo("home")}><span>⌂</span> 업무 홈</button>
          <button onClick={() => scrollTo("all-tools")}><span>▦</span> 전체 도구 <b>{tools.length}</b></button>
          <button onClick={() => scrollTo("recent-tools")}><span>◷</span> 최근 사용</button>
          <button onClick={() => scrollTo("data-center")}><span>◇</span> 데이터 관리</button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="backup-card">
          <span className="backup-icon" aria-hidden="true">↧</span>
          <strong>내 자료 챙기기</strong>
          <p>도구에 저장한 자료를 한 파일로 보관하세요.</p>
          <button onClick={downloadBackup}>통합 백업</button>
        </div>
        <div className="local-badge"><span /> 이 브라우저에 안전하게 저장</div>
      </aside>

      {menuOpen && <button className="menu-scrim" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)} />}

      <section className="page" id="home">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기">☰</button>
          <div className="search-wrap">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="업무 도구나 기능을 검색하세요"
              aria-label="도구 검색"
            />
            <kbd>검색</kbd>
          </div>
          <div className="date-chip"><span>{today || "오늘"}</span><i /></div>
        </header>

        <div className="content">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <span className="eyebrow"><i /> 반복 업무는 짧게, 퇴근은 가볍게</span>
              <h1 id="hero-title">오늘도, 서무는<br /><em>가볍게.</em></h1>
              <p>급여부터 정산, 물품, 명단까지.<br />필요한 도구를 한곳에서 바로 시작하세요.</p>
              <button className="primary-action" onClick={() => scrollTo("all-tools")}>업무 도구 보기 <span>↓</span></button>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="hero-card card-back"><span>오늘의 서무</span><b>{tools.length}</b><small>도구 준비 완료</small></div>
              <div className="hero-card card-front">
                <div className="mini-head"><span>업무 흐름</span><i>완료</i></div>
                <div className="mini-task"><b>✓</b><span>필요한 도구 선택</span></div>
                <div className="mini-task"><b>✓</b><span>자료 작성·검증</span></div>
                <div className="mini-task faded"><b>3</b><span>파일로 저장</span></div>
                <div className="mini-progress"><i /></div>
              </div>
              <span className="spark spark-one">✦</span><span className="spark spark-two">✦</span>
            </div>
          </section>

          <section className="section-block" id="all-tools">
            <div className="section-heading">
              <div><span className="section-kicker">WORK TOOLS</span><h2>무슨 업무를 시작할까요?</h2></div>
              <span className="tool-count">{filteredTools.length}개의 도구</span>
            </div>

            <div className="filter-row" aria-label="도구 분류">
              {categoryOptions.map((option) => (
                <button
                  key={option}
                  className={category === option ? "selected" : ""}
                  onClick={() => setCategory(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            {filteredTools.length ? (
              <div className="tool-grid">
                {filteredTools.map((tool, index) => (
                  <article className={`tool-card tone-${tool.tone}`} key={tool.id} style={{ "--delay": `${index * 45}ms` } as React.CSSProperties}>
                    <div className="card-top">
                      <span className="tool-mark" aria-hidden="true">{tool.mark}</span>
                      <button
                        className={`favorite ${favorites.includes(tool.id) ? "is-favorite" : ""}`}
                        aria-label={`${tool.name} ${favorites.includes(tool.id) ? "즐겨찾기 해제" : "즐겨찾기 추가"}`}
                        onClick={() => toggleFavorite(tool.id)}
                      >☆</button>
                    </div>
                    <span className="category-label">{tool.category}</span>
                    <h3>{tool.name}</h3>
                    <p>{tool.description}</p>
                    <div className="feature-list">
                      {tool.features.map((feature) => <span key={feature}>#{feature}</span>)}
                    </div>
                    <div className="card-footer">
                      <span className={`save-state ${savedTools.includes(tool.id) ? "has-data" : ""}`}>
                        <i />{tool.storageKeys.length ? (savedTools.includes(tool.id) ? "저장 자료 있음" : "새로 시작") : "파일 기반"}
                      </span>
                      <button className="open-button" onClick={() => openTool(tool)}>{tool.download ? "다운로드" : "열기"} <span>{tool.download ? "↓" : "→"}</span></button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state"><span>⌕</span><h3>찾는 도구가 없어요</h3><p>검색어를 줄이거나 다른 업무 분류를 선택해 보세요.</p><button onClick={() => { setQuery(""); setCategory("전체"); }}>전체 도구 보기</button></div>
            )}
          </section>

          <section className="lower-grid">
            <div className="recent-panel" id="recent-tools">
              <div className="panel-heading"><div><span className="section-kicker">RECENT</span><h2>최근 사용</h2></div><span>최대 3개</span></div>
              {recentTools.length ? (
                <div className="recent-list">
                  {recentTools.map((tool, index) => (
                    <button key={tool.id} onClick={() => openTool(tool)}>
                      <span className={`recent-mark tone-${tool.tone}`}>{tool.mark}</span>
                      <span><b>{tool.shortName}</b><small>{index === 0 ? "가장 최근에 사용" : "최근 사용한 도구"}</small></span>
                      <i>→</i>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="recent-empty"><span>◷</span><p>도구를 열면 여기에<br />최근 사용 순서로 표시돼요.</p></div>
              )}
            </div>

            <div className="data-panel" id="data-center">
              <span className="data-orb" aria-hidden="true">◇</span>
              <span className="section-kicker">DATA CARE</span>
              <h2>자료는 내 브라우저에</h2>
              <p>작성 중인 내용은 외부 서버로 보내지 않고 현재 브라우저에 저장됩니다. 중요한 자료는 통합백업으로 따로 보관해 주세요.</p>
              <div className="data-actions">
                <button className="backup-action" onClick={downloadBackup}>↧ 통합백업 저장</button>
                <button className="restore-action" onClick={() => restoreInput.current?.click()}>↥ 백업 복원</button>
              </div>
              <input ref={restoreInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={restoreBackup} />
            </div>
          </section>

          <footer>
            <span><b>서무랜드</b> · 행정업무를 가볍게</span>
            <span>모든 도구는 브라우저에서 실행됩니다.</span>
          </footer>
        </div>
      </section>

      {activeTool && (
        <section className="tool-workspace" role="dialog" aria-modal="true" aria-label={`${activeTool.name} 실행 화면`}>
          <header>
            <button className="workspace-back" onClick={() => setActiveTool(null)} aria-label="허브로 돌아가기">←</button>
            <span className={`workspace-mark tone-${activeTool.tone}`}>{activeTool.mark}</span>
            <div><strong>{activeTool.name}</strong><small>서무업무 허브에서 실행 중</small></div>
            <span className="workspace-saved"><i /> 브라우저 저장</span>
            <a href={activeTool.href} target="_blank" rel="noopener noreferrer">새 창에서 열기 ↗</a>
            <button className="workspace-close" onClick={() => setActiveTool(null)}>허브로 돌아가기</button>
          </header>
          <iframe src={activeTool.href} title={activeTool.name} />
        </section>
      )}

      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
