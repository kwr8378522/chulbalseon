/* =====================================================================
 * data.js — 게임의 모든 밸런스 수치가 모여 있는 파일
 * ---------------------------------------------------------------------
 * - 금액 단위는 전부 "만원"입니다. (10000 = 1억)
 * - 소득은 "세전 월소득(만원)"입니다.
 * - 금액은 2020년대 중반 가치로 고정이며 물가상승은 없습니다.
 *   그래서 금리·수익률은 명목이 아니라 "실질"에 가깝게 낮게 잡았습니다.
 * - [추정치] 표시는 정확한 통계가 아니라 그럴듯한 범위로 잡은 값입니다.
 * - 확률은 0~1 사이 값입니다. 대부분의 확률은 "평균적인 사람(능력치 50)"
 *   기준이며, 능력치에 따라 로지스틱 곡선으로 오르내립니다.
 * ===================================================================== */
var D = {
  VERSION: 7,
  PEERS: 30,          // 동년배 인원
  REROLLS: 0,         // 캐릭터 다시 굴리기 횟수 (0이면 무제한)
  LUCK_SHIFT: 0.04,
  // 난이도(플레이어만): 입시·취업·시험·승진·연애 등 확률이 보이는 모든 판정에 적용되고, 화면에 "쉬움 +N%p"로 표시된다.
  // prob 판정 확률 보정(양수면 남은 실패 확률의 그만큼을 성공으로, 음수면 확률에 곱해 깎음), bad 나쁜 일(질병·이별·폐업 위기·불운한 사건)이 닥칠 확률 배수, layoff 해고·희망퇴직 배수,
  // promo 자동 승진 로짓 보정, exec 임원 승진 확률 배수, execFloor 쉬움에서 임원 심사의 최소 기준 확률(중소기업 / 그 밖)
  DIFF: { '2': { name: '축복 모드', tag: '축복', prob: 0.7, bad: 0.2, layoff: 0.1, promo: 1.8, exec: 8, execFloor: [0.85, 0.45] },
    '1': { name: '쉬움', tag: '쉬움', prob: 0.4, bad: 0.5, layoff: 0.35, promo: 0.9, exec: 4, execFloor: [0.55, 0.12] }, '0': { name: '보통', tag: '', prob: 0, bad: 1, layoff: 1, promo: 0, exec: 1 }, '-1': { name: '어려움 (고난 모드)', tag: '어려움', prob: -0.2, bad: 1.35, layoff: 1.4, promo: -0.4, exec: 0.7 } },   // 숨은 운(0~100)이 판정에 주는 최대 보정(±4%p)
  NEWS_AGES: [13, 16, 19, 22, 25, 28, 30, 33, 35, 38, 40, 43, 45, 48, 50, 53, 55, 58, 60, 63, 65, 68, 70, 75, 80, 85, 90, 95, 99],

  /* ---------------- 집안 ---------------- */
  // w: 비율(중간층이 가장 많게), assets: 부모 순자산 범위, inc: 부모 월소득 범위  [추정치: 가계금융복지조사 대략 수준]
  CLASS: [null,
    { name: '1분위', nick: '흙수저', w: 0.14, assets: [300, 4000], inc: [130, 230] },
    { name: '2분위', nick: '동수저', w: 0.24, assets: [4000, 18000], inc: [230, 380] },
    { name: '3분위', nick: '중산층', w: 0.32, assets: [18000, 60000], inc: [380, 650] },
    { name: '4분위', nick: '은수저', w: 0.20, assets: [60000, 180000], inc: [650, 1200] },
    { name: '5분위', nick: '금수저', w: 0.10, assets: [180000, 3000000], inc: [1200, 5000] },
    { name: '최상위 0.1%', nick: '재벌가', w: 0.006, assets: [5000000, 60000000], inc: [8000, 40000] }   // 주사위에서 아주 드물게 나온다
  ],
  PARENT_JOBS: [null,
    ['일용직 노동자', '영세 자영업자', '비정규 서비스직', '농어업인', '경비원', '무직'],
    ['중소기업 생산직', '택시 기사', '화물차 기사', '작은 식당 주인', '마트 판매직', '요양보호사'],
    ['중소기업 과장', '9급 출신 공무원', '초등학교 교사', '대기업 생산직', '동네 학원 원장', '간호사', '은행원'],
    ['대기업 부장', '공기업 간부', '약사', '세무사', '대학 교수', '중견기업 임원', '5급 공무원'],
    ['개원의', '대형 로펌 변호사', '대기업 임원', '중소기업 대표', '건물주', '고위 공직자'],
    ['그룹 회장', '그룹 부회장', '대기업 오너 2세', '재계 서열 30위권 그룹 총수']
  ],
  PARENT_EDU: ['중졸 이하', '고졸', '전문대졸', '대졸', '대학원졸'],
  PARENT_EDU_W: [null,           // 분위별 부모 학력 분포 [추정치]
    [0.25, 0.50, 0.12, 0.12, 0.01],
    [0.10, 0.48, 0.18, 0.22, 0.02],
    [0.03, 0.30, 0.20, 0.42, 0.05],
    [0.01, 0.12, 0.12, 0.57, 0.18],
    [0.01, 0.07, 0.06, 0.50, 0.36],
    [0.00, 0.02, 0.03, 0.45, 0.50]
  ],
  // 출생지 분포: [강남권, 서울 기타, 수도권 신도시, 광역시, 지방 중소도시, 농어촌]
  REGION_KEYS: ['gangnam', 'seoul', 'newtown', 'metro', 'city', 'rural'],
  REGION_W: [null,
    [0.00, 0.14, 0.14, 0.24, 0.28, 0.20],
    [0.00, 0.16, 0.20, 0.26, 0.26, 0.12],
    [0.02, 0.18, 0.26, 0.26, 0.20, 0.08],
    [0.10, 0.24, 0.28, 0.22, 0.13, 0.03],
    [0.38, 0.24, 0.16, 0.12, 0.08, 0.02],
    [0.72, 0.20, 0.05, 0.03, 0.00, 0.00]
  ],
  /* ---------------- 지역·부동산 ----------------
   * price: 국민평형 아파트 매매가, jr: 전세가율, rent: 1인 월세, g: 연 실질 상승률, boom: 급등기 민감도, acad: 학군 보정
   * [추정치: KB시세·실거래가 대략 수준] */
  REG: {
    gangnam: { name: '서울 강남권', short: '강남', price: 250000, jr: 0.48, rent: 95, g: 0.022, boom: 1.3, acad: 3, rank: 5 },
    seoul:   { name: '서울(비강남)', short: '서울', price: 120000, jr: 0.55, rent: 70, g: 0.016, boom: 1.2, acad: 1, rank: 4 },
    newtown: { name: '수도권 신도시', short: '신도시', price: 78000, jr: 0.60, rent: 55, g: 0.011, boom: 1.1, acad: 1, rank: 3 },
    metro:   { name: '광역시', short: '광역시', price: 45000, jr: 0.65, rent: 45, g: 0.004, boom: 0.8, acad: 0, rank: 2 },
    city:    { name: '지방 중소도시', short: '지방 도시', price: 26000, jr: 0.70, rent: 38, g: -0.001, boom: 0.4, acad: -0.5, rank: 1 },
    rural:   { name: '농어촌', short: '농어촌', price: 13000, jr: 0.70, rent: 28, g: -0.006, boom: 0.2, acad: -1.5, rank: 0 }
  },
  HOUSE: {
    villa: 0.42,          // 빌라·소형의 아파트 대비 가격 비율
    buyCost: 0.03,        // 취득세·중개비 등
    sellCost: 0.02,
    monthlyDeposit: 1000, // 월세 보증금
    familyRentMult: 1.9,  // 2인 이상 가구 월세 배수
    fraudVilla: 0.008,    // 전세 사기 연간 확률(빌라)
    fraudApt: 0.001,
    cheongyakDiscount: 0.8, // 분양가 = 시세의 80%
    cheongyakBase: 0.03, cheongyakPerYear: 0.012, cheongyakPerKid: 0.05, cheongyakMax: 0.45,
    gapTax: 0.2,          // 갭투자 양도차익 과세(단순화)
    reversePension: { 60: 0.0020, 65: 0.0024, 70: 0.0030, 75: 0.0037, 80: 0.0047 } // 주택연금 월 지급률(집값 대비) [추정치]
  },
  LOAN: {
    rate: 0.035,        // 대출 금리(실질) [추정치]
    studentRate: 0.017,
    ltv: 0.7, ltvStretch: 0.8,
    dsr: 0.40, dsrStretch: 0.60,  // 영끌은 신용대출·부모찬스까지 끌어모은 상태를 DSR 60%로 표현
    years: 30,
    jeonseLtv: 0.8
  },
  RATE: { deposit: 0.012, stockMean: 0.05, stockSd: 0.14, stockDrag: 0.012, coinSd: 0.3 },

  /* ---------------- 거시 이벤트 ---------------- */
  MACRO: {
    crisis: { p: 0.07, dur: [1, 2], stock: [-0.38, -0.15], house: -0.06, hire: 0.6, layoff: 2.5, biz: 1.8, name: '경제위기' },
    boom:   { p: 0.07, dur: [2, 4], stock: [0.0, 0.15], house: 0.09, hire: 1.0, layoff: 1, biz: 1, name: '부동산 급등기' },
    hike:   { p: 0.07, dur: [2, 3], stock: [-0.15, 0.05], house: -0.035, rate: 0.025, hire: 0.9, layoff: 1.2, biz: 1.2, name: '금리 인상기' },
    bull:   { p: 0.08, dur: [1, 2], stock: [0.18, 0.40], house: 0.01, hire: 1.15, layoff: 0.8, biz: 0.9, name: '주식 활황' },
    coinBoom: 0.12, coinBoomRet: [1.0, 3.0], coinCrash: 0.28, coinCrashRet: [-0.78, -0.4]
  },

  /* ---------------- 세금·연금·생활비 ---------------- */
  // 세전 월소득 → 실효 공제율(소득세+4대보험), 구간 사이는 선형 보간 [추정치]
  TAX: [[0, 0.0], [150, 0.07], [250, 0.10], [350, 0.12], [500, 0.15], [700, 0.19], [1000, 0.24], [1500, 0.30], [3000, 0.37], [6000, 0.42], [20000, 0.45]],
  PENSION: {
    cap: 617,            // 국민연금 기준소득월액 상한
    avgA: 300,           // 전체 가입자 평균소득(A값)
    perYear: 0.01,       // 가입 1년당 소득대체율
    minYears: 10,
    selfRatio: 0.6,      // 자영업·프리랜서의 신고소득 비율
    civilPerYear: 0.017, // 공무원·사학연금
    basic: 34,           // 기초연금
    basicAssetLimit: 40000,
    start: 65
  },
  LIVE: {
    base: 115,         // 1인 최소 생활비(월)
    addAdult: 55,
    floor: 70,         // 극단적 긴축 생활비
    mpc: 0.62,         // 최소 생활비 초과 소득 중 소비 비율
    wealthSpend: 0.004,// 순자산 10억 초과분의 연 소비율
    welfare: 100,      // 기초생활보장 급여(생계+주거, 1인)
    welfareAsset: 3000
  },
  KID: {
    // 자녀 1명당 월 양육비(기본) [추정치]
    base: [[0, 70], [7, 55], [13, 70], [19, 110], [23, 0]],
    care: 70,                         // 맞벌이 영유아 돌봄 비용
    edu: [                            // 사교육 수준별 월 비용(초등 / 중고등)
      { name: '최소한', elem: 15, sec: 25, score: -2.5 },
      { name: '남들만큼', elem: 50, sec: 80, score: 0 },
      { name: '올인', elem: 150, sec: 260, score: 3 }
    ],
    fert: [[34, 0.85], [39, 0.6], [44, 0.22], [99, 0.02]], // 여성 나이별 임신 성공률
    childSupport: 80                  // 이혼 후 자녀 1인당 양육비
  },
  WED: { cost: 3500, small: 1200 },
  GIFT: {                           // 부모의 지원(증여) [추정치]
    marry: [0, 300, 2500, 10000, 40000, 150000, 600000],
    house: [0, 0, 1500, 8000, 30000, 100000, 500000],
    inheritFree: 100000,            // 상속 공제(10억)
    inheritTax: 0.35                // 공제 초과분 실효세율
  },

  /* ---------------- 교육 ---------------- */
  EDU: {
    w: { iq: 0.58, dil: 0.36, zeal: 0.06, harmony: 0.04 },   // 학업 역량 = 지능·성실·집안 분위기
    susi: { iq: 0.40, dil: 0.55, ab: 0.8 },                   // 수시(내신)는 성실성 비중이 큼
    susiAdj: { sci: -2, foreign: -2, private: -2, general: 1, arts: 0, voc: 0 }, // 특목·자사고는 내신 불리
    ruralSusi: 2.5,                                           // 농어촌 특별전형
    kSusi: 3.3, kJeongsi: 4.4,                                // 판정 곡선의 완만함(클수록 변수가 큼)
    kinder: { cost: 150, acad: 1.2 },
    earlyArts: { cost: 45, skill: 7 },
    tutor: {
      none:   { name: '학원 없이', cost: 0, acad: -1.2, happy: 2 },
      normal: { name: '보습학원 한두 개', cost: 40, acad: 0, happy: 0 },
      high:   { name: '선행 학원 풀코스', cost: 110, acad: 1.8, happy: -3 },
      max:    { name: '대치동식 올인', cost: 250, acad: 3.0, happy: -6 }
    },
    mid: { intl: { cut: 66, k: 4, lottery: 0.25, cost: 130, acad: 2 }, arts: { cost: 110, skill: 8 } },
    high: {
      sci:     { name: '과학고·영재고', cut: 77.5, k: 3.2, cost: 60, acad: 4 },
      foreign: { name: '외고·국제고', cut: 70, k: 3.5, cost: 110, acad: 2.5 },
      private: { name: '자사고', cut: 64.5, k: 3.5, cost: 90, acad: 2 },
      arts:    { name: '예고·체고', cut: 74, k: 5, cost: 130, acad: -3, skill: 10 },
      general: { name: '일반고', acad: 0 },
      voc:     { name: '특성화고', acad: -6 }
    },
    // 특목·자사고 입시 준비(15세): bonus는 고입 판정 점수에 더해진다. 선행 학원을 다녔으면 tutorBonus가 추가로 붙는다
    hsPrep: [{ name: '학교 공부와 독학', cost: 0, bonus: 0 }, { name: '주말 입시 특강', cost: 70, bonus: 3 }, { name: '특목·자사고 입시 전문학원', cost: 190, bonus: 7 }],
    tutorBonus: { none: -1.5, normal: 0, high: 1.5, max: 3 },
    meister: { cut: 45, k: 5 },                               // 마이스터고 합격선
    // 고3 입시 전략(18세): medBonus는 의·치·한·약·수 지원 점수에만 붙는다
    examPrep: { med: { name: '의대 전문 입시반', cost: 420, ab: 1.5, medBonus: 6 }, cons: { name: '입시 컨설팅·학생부 관리', cost: 130, susi: 2.5 } },
    skillComp: { base: 0.3, prize: [0, 400, 800, 1200] },    // 전국기능경기대회 입상 확률, 동·은·금 상금
    highLife: { all: 2.5, play: -3 },
    resuGain: [2.4, 3.0], resuCost: 2500, resuSelfGain: [1.0, 3.5]
  },
  // cut: 합격선(학업 점수), years: 수업 연한, tuition: 연 등록금, spec: 취업 스펙 기본값 [추정치]
  UNIV: {
    med:     { name: '의과대학', cut: 77.3, years: 6, tuition: 1100 },
    medpro:  { name: '치·한·약·수', cut: 74.5, years: 6, tuition: 1000 },
    sky:     { name: '서울 최상위권 대학', cut: 71.3, years: 4, tuition: 850 },
    top:     { name: '서울 상위권 대학', cut: 65.3, years: 4, tuition: 850 },
    edu:     { name: '교육대학', cut: 62, years: 4, tuition: 350 },
    seoul:   { name: '서울 소재 대학', cut: 60.3, years: 4, tuition: 800 },
    natl:    { name: '수도권·지방거점국립대', cut: 54.5, years: 4, tuition: 480 },
    local:   { name: '지방 사립대', cut: 46, years: 4, tuition: 720 },
    college: { name: '전문대', cut: 34, years: 2, tuition: 600 },
    arts:    { name: '예체능 계열 대학', cut: 70, years: 4, tuition: 950, lesson: 3000 },
    abroad:  { name: '해외 대학', cut: 64, years: 4, tuition: 8000, needAssets: 120000 }
  },
  MAJOR: {
    eng: { name: '공학', hire: 1.35 }, biz: { name: '상경', hire: 1.10 }, sci: { name: '자연과학', hire: 0.90 },
    hum: { name: '인문·사회', hire: 0.65 }, edu: { name: '사범', hire: 0.55 }, arts: { name: '예체능', hire: 0.35 },
    voc2: { name: '실무 계열', hire: 0.85 }, med: { name: '의학', hire: 1 }
  },
  MEDPRO: {   // 치·한·약·수 세부 (emp: 근무, own: 개업 평균, loan: 개업 대출)
    dent:  { name: '치과의사', school: '치과대학', emp: 850, own: 1700, loan: 40000 },
    orient:{ name: '한의사', school: '한의과대학', emp: 600, own: 1000, loan: 20000 },
    pharm: { name: '약사', school: '약학대학', emp: 520, own: 950, loan: 25000 },
    vet:   { name: '수의사', school: '수의과대학', emp: 430, own: 850, loan: 20000 }
  },

  /* ---------------- 취업 확률 ---------------- */
  // 대학 등급별 1회 지원 시 합격 확률(평균 능력치·평균 전공 기준) [추정치]
  HIRE: {
    large:   { sky: 0.44, top: 0.33, abroad: 0.36, seoul: 0.21, natl: 0.13, edu: 0.08, local: 0.055, college: 0.028, arts: 0.03, voc: 0.012, hs: 0.008 },
    public:  { sky: 0.26, top: 0.20, abroad: 0.14, seoul: 0.13, natl: 0.11, edu: 0.07, local: 0.04, college: 0.02, arts: 0.015, voc: 0.02, hs: 0.006 },
    mid:     { sky: 0.85, top: 0.75, abroad: 0.70, seoul: 0.58, natl: 0.45, edu: 0.35, local: 0.27, college: 0.16, arts: 0.10, voc: 0.08, hs: 0.05 },
    small:   { sky: 0.97, top: 0.96, abroad: 0.95, seoul: 0.93, natl: 0.90, edu: 0.85, local: 0.85, college: 0.80, arts: 0.6, voc: 0.75, hs: 0.6 },
    startup: { sky: 0.85, top: 0.78, abroad: 0.8, seoul: 0.62, natl: 0.5, edu: 0.3, local: 0.35, college: 0.25, arts: 0.3, voc: 0.12, hs: 0.1 },
    foreign: { sky: 0.10, top: 0.07, abroad: 0.30, seoul: 0.04, natl: 0.025, edu: 0.01, local: 0.012, college: 0.008, arts: 0.01, voc: 0.004, hs: 0.003 },
    factoryL:{ sky: 0.03, top: 0.03, abroad: 0.02, seoul: 0.03, natl: 0.04, edu: 0.02, local: 0.05, college: 0.17, arts: 0.02, voc: 0.12, hs: 0.035 }
  },
  HIRE_STATS: { iq: 0.25, dil: 0.3, social: 0.3 },
  HIRE_SPEC: 0.13,        // 스펙 1점당 로짓 가산
  HIRE_AGE: { from: 29, pen: 0.15 },   // 29세 이후 1년당 로짓 감점
  EXAM: {   // 1년 준비 후 합격 확률(평균 능력치) [추정치]
    civil9:  { name: '9급 공무원', base: 0.21, stats: { iq: 0.5, dil: 0.7 }, cost: 1200 },
    civil7:  { name: '7급 공무원', base: 0.06, stats: { iq: 0.7, dil: 0.7 }, cost: 1400 },
    gosi5:   { name: '5급 공채(행정고시)', base: 0.006, stats: { iq: 1.0, dil: 0.8 }, cost: 1800, tier: { sky: 1.3, top: 0.7, abroad: 0.5, seoul: 0.2 } },
    teacher: { name: '교원 임용시험', base: 0.10, baseEdu: 0.40, stats: { iq: 0.4, dil: 0.6 }, cost: 1000 },
    cpa:     { name: '공인회계사(CPA)', base: 0.03, stats: { iq: 0.9, dil: 0.9 }, cost: 1500, tier: { sky: 0.9, top: 0.6, abroad: 0.4, seoul: 0.3 } },
    tax:     { name: '세무사', base: 0.035, stats: { iq: 0.7, dil: 0.9 }, cost: 1300 },
    lawAdm:  { name: '로스쿨 입시', tier: { sky: 0.16, top: 0.07, abroad: 0.07, seoul: 0.03, natl: 0.018, edu: 0.01, local: 0.006, arts: 0.004 }, stats: { iq: 0.8, dil: 0.5 } },
    bar:     { name: '변호사시험', base: 0.68, stats: { iq: 0.5, dil: 0.6 }, repeatPen: 0.5, max: 5 },
    grad:    { name: '대학원(석사)', base: 0.75, stats: { iq: 0.5, dil: 0.3 }, cost: 1200, years: 2 },
    phd:     { name: '박사과정', base: 0.6, stats: { iq: 0.7, dil: 0.5 }, cost: 600, years: 4 },
    prof:    { name: '교수 임용', base: 0.035, stats: { iq: 0.8, dil: 0.5, social: 0.4 }, tier: { sky: 0.9, top: 0.4, abroad: 1.0 } },
    research:{ name: '연구원 채용', base: 0.45, stats: { iq: 0.5, dil: 0.4 } },
    abroadStudy: { cost: 20000, needAssets: 80000, years: 3 },
    lawCost: 2200, lawYears: 3     // 로스쿨 연 학비+생활비
  },

  /* ---------------- 직업 ----------------
   * type: corp(직급제) / steady(호봉제) / pro(전문직 근무) / own(전문직 개업) / biz(자영업·창업) / gig(불안정)
   * retire: 정년(없으면 정년 없음), sev: 퇴직금 여부, pen: 'civil'이면 공무원·사학연금
   * joy: 직업이 행복도 목표치에 주는 보정, wear: 연간 건강 소모 [추정치: 고용노동부·국세청 통계 대략 수준] */
  JOBS: {
    large:   { name: '대기업', type: 'corp', retire: 60, sev: 1, joy: 2, wear: 0.4, metro: 0.5,
               ranks: [['사원', 430, 4, 0.9], ['대리', 540, 4, 0.82], ['과장', 670, 5, 0.6], ['차장', 800, 5, 0.42], ['부장', 950, 99, 0], ['임원', 2300, 99, 0]],
               exec: 0.012, execOut: 0.2, layoff: 0.006 },
    public:  { name: '공기업', type: 'corp', retire: 60, sev: 1, joy: 4, wear: 0.1,
               ranks: [['사원', 370, 5, 0.9], ['대리', 450, 5, 0.8], ['과장', 540, 6, 0.65], ['차장', 640, 6, 0.5], ['부장', 760, 99, 0], ['본부장', 1100, 99, 0]],
               exec: 0.008, execOut: 0.25, layoff: 0.001 },
    mid:     { name: '중견기업', type: 'corp', retire: 60, sev: 1, joy: 0, wear: 0.3, metro: 0.3,
               ranks: [['사원', 330, 4, 0.9], ['대리', 400, 4, 0.82], ['과장', 480, 5, 0.65], ['차장', 570, 5, 0.5], ['부장', 680, 99, 0], ['임원', 1150, 99, 0]],
               exec: 0.016, execOut: 0.15, layoff: 0.018 },
    small:   { name: '중소기업', type: 'corp', retire: 60, sev: 1, joy: -2, wear: 0.4,
               ranks: [['사원', 255, 4, 0.9], ['대리', 300, 4, 0.85], ['과장', 350, 5, 0.7], ['차장', 405, 5, 0.6], ['부장', 465, 99, 0], ['이사', 620, 99, 0]],
               exec: 0.05, execOut: 0.1, layoff: 0.04 },
    startup: { name: '스타트업', type: 'steady', start: 330, max: 800, span: 14, sev: 1, joy: 1, wear: 0.5, metro: 0.6, fold: 0.11, jackpot: 0.025, jackpotAmt: [8000, 80000] },
    foreign: { name: '해외 기업', type: 'steady', start: 620, max: 1300, span: 15, sev: 1, joy: 2, wear: 0.3, layoff: 0.05 },
    civil9:  { name: '9급 공무원', type: 'steady', start: 235, max: 560, span: 32, retire: 60, sev: 0.4, pen: 'civil', joy: 3, wear: 0.1 },
    civil7:  { name: '7급 공무원', type: 'steady', start: 275, max: 660, span: 30, retire: 60, sev: 0.4, pen: 'civil', joy: 4, wear: 0.1 },
    civil5:  { name: '5급 사무관', type: 'steady', start: 390, max: 950, span: 28, retire: 60, sev: 0.4, pen: 'civil', joy: 4, wear: 0.4 },
    teacher: { name: '교사', type: 'steady', start: 275, max: 630, span: 34, retire: 62, sev: 0.4, pen: 'civil', joy: 4, wear: 0.2 },
    prof:    { name: '대학 교수', type: 'steady', start: 560, max: 1050, span: 25, retire: 65, sev: 0.4, pen: 'civil', joy: 8, wear: 0.1 },
    research:{ name: '연구원', type: 'steady', start: 450, max: 850, span: 22, retire: 61, sev: 1, joy: 4, wear: 0.1 },
    heir:    { name: '가업 후계자', type: 'steady', start: 520, max: 2200, span: 18, sev: 0, joy: 1, wear: 0.4 },
    // 직업군인: 장교는 직급제(계급), rankAge는 계급정년
    officer: { name: '직업군인(장교)', type: 'corp', retire: 60, sev: 0.4, pen: 'civil', joy: 2, wear: 0.6, mil: 1,
               ranks: [['중위', 300, 2, 0.97], ['대위', 400, 6, 0.55], ['소령', 540, 6, 0.5], ['중령', 680, 6, 0.3], ['대령', 840, 99, 0], ['준장', 1150, 99, 0]],
               rankAge: [40, 43, 45, 53, 56, 60], exec: 0.1, execOut: 0.2, layoff: 0 },
    nco:     { name: '부사관', type: 'steady', start: 225, max: 520, span: 28, retire: 55, sev: 0.4, pen: 'civil', joy: 1, wear: 0.6 },
    celeb:   { name: '연예인', type: 'gig', avg: 140, sd: 0.3, joy: 6, wear: 0.5 },
    lecturer:{ name: '시간강사', type: 'gig', avg: 170, sd: 0.2, joy: -3, wear: 0.2 },
    factoryL:{ name: '대기업 생산직', type: 'steady', start: 470, max: 880, span: 25, retire: 60, sev: 1, joy: 2, wear: 0.7 },
    factoryS:{ name: '중소기업 생산직', type: 'steady', start: 260, max: 400, span: 20, retire: 60, sev: 1, joy: -3, wear: 0.9, layoff: 0.04 },
    trade:   { name: '기술직(전기·용접·설비)', type: 'steady', start: 270, max: 540, span: 18, sev: 0.5, joy: 0, wear: 0.8, layoff: 0.03 },
    service: { name: '비정규 서비스직', type: 'steady', start: 215, max: 265, span: 15, sev: 0.5, joy: -5, wear: 0.5, layoff: 0.12 },
    parttime:{ name: '아르바이트', type: 'gig', avg: 120, sd: 0.15, joy: -6, wear: 0.3 },
    delivery:{ name: '배달·대리운전', type: 'gig', avg: 290, sd: 0.2, joy: -5, wear: 1.3, maxAge: 67 },
    guard:   { name: '경비·시설관리', type: 'gig', avg: 215, sd: 0.08, joy: -2, wear: 0.5, maxAge: 76 },
    senior:  { name: '노인 일자리', type: 'gig', avg: 45, sd: 0.2, joy: 3, wear: 0.0, maxAge: 85 },
    advisor: { name: '자문·고문', type: 'gig', avg: 420, sd: 0.3, joy: 4, wear: 0.0, maxAge: 72 },
    freelance:{ name: '프리랜서', type: 'gig', avg: 290, sd: 0.4, joy: 2, wear: 0.4, skill: 1 },
    artist:  { name: '예술인', type: 'gig', avg: 105, sd: 0.5, joy: 8, wear: 0.2, star: 0.012, starInc: [1500, 9000] },
    // 의사 경로
    resident:{ name: '전공의', type: 'pro', curve: [[0, 370], [5, 420]], joy: -4, wear: 1.2, sev: 0 },
    milDoc:  { name: '군의관·공중보건의', type: 'pro', curve: [[0, 290], [3, 300]], joy: -2, wear: 0.1, sev: 0 },
    doc:     { name: '봉직의', type: 'pro', curve: [[0, 1350], [5, 1650], [15, 1850]], joy: 4, wear: 0.5, sev: 1 },
    docProf: { name: '대학병원 교수', type: 'pro', curve: [[0, 1000], [10, 1400], [20, 1700]], retire: 65, joy: 7, wear: 0.8, sev: 0.4, pen: 'civil' },
    docOwn:  { name: '개원의', type: 'own', avg: 2900, sd: 0.3, loan: 50000, close: 0.035, joy: 4, wear: 0.6 },
    medEmp:  { name: '근무(치·한·약·수)', type: 'pro', curve: [[0, 1], [8, 1.25]], joy: 3, wear: 0.3, sev: 1 },   // MEDPRO.emp × 배수
    medOwn:  { name: '개업(치·한·약·수)', type: 'own', avg: 1, sd: 0.35, close: 0.04, joy: 4, wear: 0.4 },         // MEDPRO.own × 배수
    // 법조
    lawBig:  { name: '대형 로펌 변호사', type: 'pro', curve: [[0, 1300], [8, 1900]], joy: 0, wear: 1.2, sev: 1, partnerAt: 9, partner: 0.25, partnerInc: 4200 },
    lawIn:   { name: '사내변호사', type: 'pro', curve: [[0, 650], [12, 1100]], retire: 60, joy: 3, wear: 0.3, sev: 1 },
    lawGov:  { name: '판·검사', type: 'pro', curve: [[0, 620], [20, 1050]], retire: 63, joy: 6, wear: 0.7, sev: 0.4, pen: 'civil' },
    lawSolo: { name: '개업 변호사', type: 'own', avg: 800, sd: 0.55, loan: 5000, close: 0.02, joy: 2, wear: 0.5 },
    cpa:     { name: '회계사(회계법인)', type: 'pro', curve: [[0, 520], [12, 1150]], joy: 0, wear: 0.9, sev: 1 },
    cpaOwn:  { name: '개업 회계사', type: 'own', avg: 1100, sd: 0.45, loan: 5000, close: 0.015, joy: 3, wear: 0.4 },
    tax:     { name: '근무 세무사', type: 'pro', curve: [[0, 350], [10, 600]], joy: 1, wear: 0.4, sev: 1 },
    taxOwn:  { name: '개업 세무사', type: 'own', avg: 780, sd: 0.5, loan: 4000, close: 0.02, joy: 3, wear: 0.4 },
    founder: { name: '스타트업 대표', type: 'biz', joy: 5, wear: 0.9 },
    biz:     { name: '자영업', type: 'biz', joy: 0, wear: 0.8 }
  },
  DOC_SPEC: {   // 전공 선택
    hot:  { name: '인기과(피부·안과·성형)', base: 0.22, mult: 1.4, joy: 2 },
    core: { name: '필수과(내과·외과·소아과)', mult: 0.95, joy: 3, wear: 0.5 },
    gp:   { name: '일반의', mult: 0.72 }
  },
  // 가업 후계자의 직급(근속 연수 기준), 부모 작고 뒤 대표이사가 되면 소득 × ceoMult
  HEIR: { ranks: [[0, '대리'], [2, '과장'], [4, '부장'], [7, '상무'], [10, '전무'], [14, '부사장']], ceoMult: 1.7, chaebolMult: 3 },
  // 연예인 등급: [이름, 월소득], up 한 해에 한 등급 오를 기준 확률, down 내려갈 확률
  CELEB: { tiers: [['연습생', 60], ['무명 연예인', 140], ['얼굴이 알려진 연예인', 650], ['인기 연예인', 3200], ['톱스타', 18000]], up: [0.4, 0.1, 0.07, 0.045], down: [0, 0, 0.1, 0.12, 0.1], base: 0.12 },
  PROMO: { push: 0.9, relax: -0.7, pushHealth: -5, pushMq: -8, stats: { dil: 0.4, social: 0.4, iq: 0.2 } },
  // 희망퇴직 압박 연간 확률(나이대별) [추정치]
  ERP: { large: [[45, 0.07], [50, 0.15], [55, 0.2]], mid: [[48, 0.05], [53, 0.1]], public: [[57, 0.03]], months: [24, 36], resistBase: 0.55, kickMonths: 6 },
  JOBCHANGE: { every: 4, raise: [0.08, 0.2], base: 0.7 },
  // 자영업 (capital: 창업 자금, avg: 평균 월 순소득, close: 초기 연 폐업률) [추정치: 국세청 폐업 통계 대략 수준]
  BIZ: {
    chicken: { name: '치킨집', capital: 10000, avg: 240, close: 0.17 },
    cafe:    { name: '카페', capital: 13000, avg: 210, close: 0.19 },
    cvs:     { name: '편의점', capital: 8000, avg: 220, close: 0.12 },
    food:    { name: '음식점', capital: 15000, avg: 290, close: 0.17 },
    academy: { name: '보습학원', capital: 9000, avg: 340, close: 0.12, needDeg: 1 },
    online:  { name: '온라인 쇼핑몰', capital: 2500, avg: 190, close: 0.24 },
    repair:  { name: '설비·인테리어 업체', capital: 5000, avg: 380, close: 0.10, needTrade: 1 },
    franchise:{ name: '대형 프랜차이즈 매장', capital: 50000, avg: 720, close: 0.10 }
  },
  BIZ_RULE: { sd: 0.45, yearSd: 0.22, earlyMult: 1.25, midMult: 0.7, lateMult: 0.4, recover: 0.2, extraDebt: [0, 5000], stats: { dil: 0.25, social: 0.25, iq: 0.1 }, expandMult: 1.7 },
  FOUNDER: { capital: 4000, exit: 0.035, exitAmt: [30000, 800000], fail: 0.24, inc: 190, growInc: 60 },

  /* ---------------- 연애·가족 ---------------- */
  LOVE: { meet: 0.16, breakup: 0.2, marryBase: 0.62, divorceMq: 24, mqStart: [70, 12] },
  // 만남 경로별 상대 조건: bias 내 등급 대비 상대 등급, sd 편차, chem 평균 궁합, base 애프터 성공 기준 확률
  DATE: {
    src: {
      blind: { name: '소개팅', bias: 0, sd: 0.8, chem: 55, base: 0.5 },
      app:   { name: '데이팅 앱', bias: -0.2, sd: 1.3, chem: 45, base: 0.38, fake: 0.15 },
      club:  { name: '동호회', bias: 0, sd: 0.9, chem: 68, base: 0.55 },
      mat:   { name: '맞선', bias: 0.3, sd: 0.6, chem: 48, base: 0.55, cls: 0.5, yrs: 1 }
    },
    // 결혼정보회사: fee 가입비, n 매칭 횟수, bias 상대 등급 보정, need 가입에 필요한 내 등급(0~5)
    agency: [
      { name: '실속형', fee: 300, n: 3, bias: 0.2, need: 0 },
      { name: '프리미엄', fee: 900, n: 5, bias: 0.7, need: 1.5 },
      { name: '노블레스', fee: 2500, n: 6, bias: 1.3, need: 3 }
    ]
  },

  /* ---------------- 분기 진행·자유 행동 (성인기 플레이어) ---------------- */
  // 성인기는 한 달 단위로 흐른다. ap: 매달 회복되는 행동력, apMax: 쌓아 둘 수 있는 최대치
  // eventP: 한 달에 선택지 있는 돌발 사건이 날 확률, newsP: 선택지 없는 소소한 사건이 날 확률(나머지 달은 계절·일상 한 줄)
  QTR: { from: 19, ap: 1, apMax: 3, eventP: 0.075, newsP: 0.3 },
  // 분기 수익률 = 지수 분기 수익률 × beta + add + (경제 국면 보정) + 잡음(sd)
  ASSETS: {
    sav:  { name: '정기예금',   beta: 0,    add: 0.0075, sd: 0,    desc: '연 3% 안팎 · 잃지 않습니다' },
    idx:  { name: '인덱스 ETF', beta: 1,    add: 0,     sd: 0.03,  desc: '시장 평균을 따라갑니다' },
    gro:  { name: '성장주',     beta: 1.7,  add: 0.001, sd: 0.08,  desc: '오를 때 더 오르고, 내릴 때 더 내립니다' },
    div:  { name: '배당주',     beta: 0.55, add: 0.007, sd: 0.02,  desc: '덜 흔들리고 배당이 나옵니다' },
    bond: { name: '채권',       beta: 0,    add: 0.007, sd: 0.008, crisis: 0.012, hike: -0.02, desc: '위기에 강하고 금리 인상에 약합니다' },
    gold: { name: '금',         beta: 0,    add: 0.007, sd: 0.04,  crisis: 0.04, bull: -0.01, desc: '위기 때 빛납니다' }
  },
  COIN_QSD: 0.12, TRADE_FEE: 0.003, CREDIT_MULT: 1.5,   // 신용대출 한도 = 가구 연소득 × CREDIT_MULT (DSR 한도 이내)
  // 연봉 협상: raise 인상률 범위, base 기준 성공 확률, 실패하면 동결. mult 상한은 capMult
  // 연말 고과: w 기본 비율(평고과 B가 가장 많음), raise 등급별 인상률. 동결은 D뿐이다.
  SALARY: {
    grades: ['S', 'A', 'B', 'C', 'D'], w: [6, 22, 53, 14, 5],
    raise: { S: [0.06, 0.09], A: [0.035, 0.05], B: [0.018, 0.03], C: [0.006, 0.012], D: [0, 0] },
    nego: { add: [0.008, 0.02], base: 0.45 }, counter: { add: [0.035, 0.06], base: 0.24 }, capMult: 2.2
  },
  // 로또: 분기 내내 매주 산다고 본다. p 누적 아님, 등수별 확률과 세후 당첨금
  LOTTO: { cost: 7, tiers: [{ name: '1등', p: 0.00025, amt: [120000, 250000] }, { name: '2등', p: 0.0025, amt: [3500, 5500] }, { name: '3등', p: 0.025, amt: [120, 160] }, { name: '4·5등', p: 0.17, amt: [5, 9] }] },
  // 수익형 건물: mult 서울 아파트 시세 대비 매매가, yield 연 임대수익률. 임대소득은 세금·관리비(BLD_COST)를 뗀다
  BLD: {
    shop:  { name: '구분상가', mult: 0.3, yield: 0.045 },
    small: { name: '꼬마빌딩', mult: 1.5, yield: 0.036 },
    tower: { name: '도심 빌딩', mult: 6, yield: 0.03 }
  },
  BLD_LTV: 0.5, BLD_COST: 0.25, BLD_GROW: 0.8, BLD_MAX: 8,
  GAP_MAX: 8,          // 전세 끼고 사 둘 수 있는 집의 수(플레이어). 동년배는 한 채만 산다
  // 자동차: price 가격, keep 월 유지비, joy 행복 보정, charm 연애 등급 보정
  DRIVE: { cost: 80, base: 0.72 },
  CAR_DEP: 0.85,
  CARS: {
    used:  { name: '중고 경차', price: 600, keep: 18, joy: 1, charm: 0.05 },
    mini:  { name: '경차', price: 1500, keep: 20, joy: 1.5, charm: 0.1 },
    sedan: { name: '준중형 세단', price: 2600, keep: 28, joy: 2, charm: 0.15 },
    suv:   { name: '중형 SUV', price: 4200, keep: 38, joy: 2.5, charm: 0.2 },
    ev:    { name: '전기차', price: 5500, keep: 22, joy: 3, charm: 0.25 },
    lux:   { name: '수입 세단', price: 9000, keep: 65, joy: 4, charm: 0.4 },
    super: { name: '슈퍼카', price: 32000, keep: 180, joy: 6, charm: 0.6 }
  },


  /* ---------------- 건강 ---------------- */
  HEALTH: {
    decline: [[30, 0], [50, 0.2], [70, 0.42], [85, 0.5], [101, 0.5]],   // 나이대별 연간 건강 감소
    exercise: 0.25, noExercise: -0.12, vice: -0.35, overwork: -0.4, hitOk: 5, hitFail: 15,
    disease: [[40, 0.004], [50, 0.012], [60, 0.025], [70, 0.045], [80, 0.065], [101, 0.08]],
    treat: {
      full: { name: '대형병원 적극 치료', cost: 5000, base: 0.82 },
      std:  { name: '건강보험 표준 치료', cost: 900, base: 0.66 },
      min:  { name: '최소한의 치료', cost: 150, base: 0.35 }
    },
    earlyBonus: 0.9, checkCost: 50, careCost: 160, silverTown: 330,
    mort: [[55, 0.002], [65, 0.005], [75, 0.013], [85, 0.035], [95, 0.09], [101, 0.15]]   // 동년배 사망률(플레이어는 100세까지 생존)
  },

  /* ---------------- 무작위 사건 ---------------- */
  // p: 연간 확률, cash/happy/health: 효과, cond: 조건 키
  EVENTS: [
    { id: 'phish', min: 22, max: 90, p: 0.006, cash: -1500, happy: -6, t: '보이스피싱에 속아 1,500만 원을 잃었습니다. "검사입니다"라던 목소리가 아직도 귀에 남습니다.' },
    { id: 'lotto', min: 20, max: 95, p: 0.004, cash: 1200, happy: 5, t: '로또 3등에 당첨됐습니다. 인생이 바뀌진 않지만, 저녁 메뉴는 바뀌었습니다.' },
    { id: 'accident', min: 19, max: 85, p: 0.008, cash: -400, health: -7, happy: -4, t: '교통사고를 당했습니다. 몇 주간 병원 신세를 졌습니다.' },
    { id: 'guarantee', min: 30, max: 65, p: 0.004, cash: -3000, happy: -8, t: '믿었던 지인에게 빌려준 돈 3,000만 원이 돌아오지 않았습니다.' },
    { id: 'pet', min: 25, max: 80, p: 0.012, cash: -150, happy: 5, t: '반려동물을 가족으로 맞았습니다. 퇴근길이 조금 가벼워졌습니다.' },
    { id: 'trip', min: 22, max: 78, p: 0.03, cash: -250, happy: 3, cond: 'hasCash', t: '오랜만에 긴 여행을 다녀왔습니다. 사진첩이 한동안 풍성했습니다.' },
    { id: 'burnout', min: 28, max: 55, p: 0.02, happy: -7, health: -3, cond: 'working', t: '번아웃이 찾아왔습니다. 월요일 아침 알람이 유난히 길게 울렸습니다.' },
    { id: 'hobby', min: 30, max: 90, p: 0.02, happy: 4, health: 1, t: '새 취미를 시작했습니다. 주말에 갈 곳이 생겼습니다.' },
    { id: 'friend', min: 19, max: 60, p: 0.025, happy: 3, t: '오랜 친구들과 밤새 옛이야기를 나눴습니다. 다들 사는 게 비슷했습니다.' },
    { id: 'flood', min: 25, max: 90, p: 0.003, cash: -800, happy: -4, cond: 'indep', t: '집에 누수가 터졌습니다. 수리비로 800만 원이 나갔습니다.' },
    { id: 'bonus', min: 26, max: 58, p: 0.03, cash: 700, happy: 3, cond: 'corp', t: '회사 실적이 좋아 성과급이 나왔습니다. 통장에 잠시 봄이 왔습니다.' },
    { id: 'award', min: 8, max: 18, p: 0.04, happy: 4, t: '학교에서 상을 받았습니다. 부모님이 냉장고에 상장을 붙여두었습니다.' },
    { id: 'bully', min: 9, max: 17, p: 0.015, happy: -8, t: '학교에서 친구 관계로 힘든 한 해를 보냈습니다.' },
    { id: 'move', min: 5, max: 15, p: 0.03, happy: -2, t: '집안 사정으로 이사를 했습니다. 새 동네의 골목은 낯설었습니다.' }
  ],
  // 유년기 집안 사건
  FAM_EVENTS: { fail: 0.012, failLoss: [0.3, 0.7], rise: 0.01, riseGain: [0.3, 0.8], divorce: 0.008 }
};
