'use strict';

/*
 * 卒論アンケートサイト（2026-11-24）
 * 質問の文言・順序・確認の行は create_form.gs（2026-11-15版）に合わせている。
 * 違い: 場面順のA/Bは生まれ月ではなくランダムに割り当てる。最後に結果とコピーの説明を出す。
 * 回答は Supabase の responses テーブルに送る（書き込み専用。ブラウザからは読めない）。
 *
 * 商品の組み合わせは URL で切り替える:
 *   （なし）      … ワイヤレスイヤホンのみ
 *   ?p=both       … ドリンクとワイヤレスイヤホン（商品の順はランダム）
 * 保存形式 web-3: ratings[商品][場面][コピーID]、interest[商品]。形は web-2 と同じで、聞き方が違う
 *   （web-2「買いたいと思うか」→ web-3「買いたい気持ちがどれくらい高まるか」。2026-11-24変更）。
 */

const SUPABASE_URL = 'https://ljsotmcpaqdlvmysvnsj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fN0wj547S7tuJyVvwKlcEg_3s1q4kyf';
const VERSION = 'web-3';

const UNIVERSITY = '名城大学';
const AUTHOR = '西垣優';
const CONTACT = 'yuurise2424@gmail.com';
const TEST_URL = 'https://www.16personalities.com/ja/%E6%80%A7%E6%A0%BC%E8%A8%BA%E6%96%AD%E3%83%86%E3%82%B9%E3%83%88';

const COPY_IDS = ['ST', 'SF', 'NT', 'NF'];
const CHECK_ROW = { id: 'CHECK', text: '確認のため、この行は「5」を選んでください' };

const SCENE_LABELS = {
  base: '時間に余裕があるとき',
  rush: '時間がないとき',
  friend: '友達と一緒のとき',
  tired: 'とても疲れているとき',
};
const ORDERS = { A: ['base', 'rush', 'friend', 'tired'], B: ['tired', 'friend', 'rush', 'base'] };

const PRODUCTS = {
  drink: {
    name: 'ドリンク',
    noun: 'このドリンク',
    img: 'drink.webp',
    imgAlt: '淡い黄色のペットボトル飲料の商品画像',
    interestLabel: '飲み物の新商品',
    intro: '次の場面を想像してください。あなたはコンビニで、この新作ドリンク（下の画像）を1本買おうとしています。お金は十分にあるので、値段は気にしなくて大丈夫です。商品はこの1つだけで、違うのは書かれている広告コピーだけです。',
    copies: {
      ST: 'ビタミンC 1000mg、糖質ゼロ',
      SF: '忙しい合間に、ほっとひと息',
      NT: '水分補給の常識を、科学で変える',
      NF: 'キャップを開けたら、何かが始まる',
    },
    scenes: {
      base: '一人で来ていて、時間には余裕があります。体調も普段通りです。',
      rush: '一人で来ていて、電車の発車まであと3分です。体調は普段通りです。',
      friend: '友達と一緒に来ていて、時間には余裕があります。体調も普段通りです。',
      tired: '一人で来ていて、時間には余裕があります。仕事やバイト、授業の帰りで、とても疲れています。',
    },
  },
  earphone: {
    name: 'ワイヤレスイヤホン',
    noun: 'このイヤホン',
    img: 'earphone.webp',
    imgAlt: 'マットブラックのワイヤレスイヤホンと充電ケースの商品画像',
    interestLabel: 'ワイヤレスイヤホン',
    intro: '次の場面を想像してください。今使っているイヤホンが壊れたので、あなたは家電量販店で、この新作ワイヤレスイヤホン（下の画像）を買おうとしています。お金は十分にあるので、値段は気にしなくて大丈夫です。商品はこの1つだけで、違うのは書かれている広告コピーだけです。',
    copies: {
      ST: '連続30時間再生、重さ4.5g',
      SF: '移動時間が、好きな時間になる',
      NT: '音の常識を、技術で変える',
      NF: '再生した瞬間、物語が始まる',
    },
    scenes: {
      base: '一人で来ていて、時間には余裕があります。体調も普段通りです。',
      rush: '一人で来ていて、この後予定があり、売り場にいられるのはあと5分です。体調は普段通りです。',
      friend: '友達と一緒に来ていて、時間には余裕があります。体調も普段通りです。',
      tired: '一人で来ていて、時間には余裕があります。仕事やバイト、授業の帰りで、とても疲れています。',
    },
  },
};
// 結果の表で、言葉の区切りで折り返すための位置（|）。文言は copies と同じにする
const COPY_PHRASES = [
  'ビタミンC |1000mg、|糖質ゼロ', '忙しい|合間に、|ほっと|ひと息', '水分補給の|常識を、|科学で|変える', 'キャップを|開けたら、|何かが|始まる',
  '連続30時間|再生、|重さ4.5g', '移動時間が、|好きな|時間に|なる', '音の|常識を、|技術で|変える', '再生した|瞬間、|物語が|始まる',
];
// 確認の行（「5」）を入れる商品。2場面目に入れる
const CHECK_PRODUCT = 'earphone';

const SETS = {
  earphone: { products: ['earphone'], minutes: 5, minutesWithTest: 15 },
  both: { products: ['drink', 'earphone'], minutes: 8, minutesWithTest: 18 },
};

const TYPES = [
  ['INTJ', '建築家'], ['INTP', '論理学者'], ['ENTJ', '指揮官'], ['ENTP', '討論者'],
  ['INFJ', '提唱者'], ['INFP', '仲介者'], ['ENFJ', '主人公'], ['ENFP', '運動家'],
  ['ISTJ', '管理者'], ['ISFJ', '擁護者'], ['ESTJ', '幹部'], ['ESFJ', '領事'],
  ['ISTP', '巨匠'], ['ISFP', '冒険家'], ['ESTP', '起業家'], ['ESFP', 'エンターテイナー'],
];
const AXES = [
  ['EI', '外向型・内向型'], ['SN', '感覚型・直観型'], ['TF', '思考型・感情型'],
  ['JP', '計画型・探索型'], ['AT', '自己主張型・慎重型'],
];
const PROFILE = [
  ['age', '年齢', ['18〜19歳', '20〜22歳', '23〜25歳', '26〜29歳', '30〜39歳', '40歳以上']],
  ['gender', '性別', ['男性', '女性', 'その他', '回答しない']],
  ['status', '現在の立場', ['大学生・大学院生', '専門学校生など', '会社員・公務員', 'パート・アルバイト', 'その他']],
  ['residence', '住まい', ['実家・家族と同居', '一人暮らし', '寮', 'その他']],
  ['money', '1か月に自由に使えるお金（家賃、光熱費、通信費、学費などの固定費を除く）',
    ['1万円未満', '1〜3万円未満', '3〜5万円未満', '5〜10万円未満', '10万円以上']],
  ['income', '1か月の収入（バイト代や給与の手取り。仕送りやお小遣いは除く）',
    ['なし', '3万円未満', '3〜5万円未満', '5〜10万円未満', '10〜20万円未満', '20万円以上', '答えたくない']],
];
const EXPERIENCE = [
  ['known', '受けたことがあり、結果が分かる'],
  ['retake', '結果が分からないので、今から受ける（約10分）'],
  ['new', '受けたことがなく、今から受ける（約10分）'],
  ['none', '受けない（回答を終了する）'],
];
const BELIEF = [
  ['accurate', '自分の診断結果は当たっていると感じる'],
  ['reliable', '16Personalitiesの診断は信頼できると思う'],
  ['use', '診断結果を、自分の選択や判断の参考にすることがある'],
];
const PAGE_TITLES = {
  consent: 'スタート', experience: '受検経験', guide: '診断の案内', profile: 'あなたについて',
  adIntro: '説明', interest: '関心', mbti: '診断結果', belief: 'さいご',
};

// ---------- state ----------

const setKey = new URLSearchParams(location.search).get('p') === 'both' ? 'both' : 'earphone';
const SET = SETS[setKey];
const productOrder = SET.products.length > 1 && Math.random() < 0.5
  ? SET.products.slice().reverse() : SET.products.slice();

const state = {
  order: Math.random() < 0.5 ? 'A' : 'B',
  a: { ratings: {}, rowOrder: {}, interest: {}, belief: {}, axes: {} },
  step: 0,
  timings: {},
  stepStartedAt: Date.now(),
  startedAt: new Date().toISOString(),
  submitted: false,
};
productOrder.forEach((p) => { state.a.ratings[p] = {}; state.a.rowOrder[p] = {}; });

const nRatings = () => productOrder.length * 16;

function steps() {
  const list = ['consent', 'experience'];
  if (state.a.experience === 'retake' || state.a.experience === 'new') list.push('guide');
  list.push('profile', 'adIntro');
  productOrder.forEach((p, pi) => { for (let s = 0; s < 4; s++) list.push('scene:' + pi + ':' + s); });
  list.push('interest', 'mbti', 'belief');
  return list;
}

// ---------- DOM helpers ----------

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 答えたら次の未回答の質問へスクロールし、全部答えたら「次へ」を光らせる
function afterAnswer(fromEl) {
  const q = fromEl.closest('.q');
  if (q) q.classList.add('done');
  const all = Array.from(app.querySelectorAll('.q'));
  const nextQ = all.find((el) => !el.querySelector('input:checked'));
  const btn = app.querySelector('.btn-primary');
  if (nextQ) {
    if (q && q.classList.contains('autoscroll')) {
      setTimeout(() => nextQ.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' }), 220);
    }
    if (btn) btn.classList.remove('ready');
  } else if (btn) {
    btn.classList.add('ready');
  }
}

function optionCards(name, legend, options, value, onChange) {
  return h('fieldset', { class: 'q' },
    h('legend', null, legend),
    h('div', { class: 'options' },
      options.map(([val, label]) => h('label', { class: 'option' },
        h('input', { type: 'radio', name, value: val, checked: value === val,
          onchange: (e) => { onChange(val); afterAnswer(e.target); } }),
        h('span', null, label)))));
}

function chips(name, legend, options, value, onChange) {
  return h('fieldset', { class: 'q' },
    h('legend', null, legend),
    h('div', { class: 'chips' },
      options.map(([val, label]) => h('label', { class: 'chip' },
        h('input', { type: 'radio', name, value: val, checked: value === val,
          onchange: (e) => { onChange(val); afterAnswer(e.target); } }),
        h('span', null, label)))));
}

function scale(name, ariaLabel, value, onChange, lowLabel, highLabel) {
  return [
    h('div', { class: 'scale', role: 'radiogroup', 'aria-label': ariaLabel },
      [1, 2, 3, 4, 5, 6, 7].map((n) => h('label', null,
        h('input', { type: 'radio', name, value: String(n), checked: value === n,
          'aria-label': ariaLabel + ' ' + n, onchange: (e) => { onChange(n); afterAnswer(e.target); } }),
        h('span', null, String(n))))),
    h('div', { class: 'scale-ends' }, h('span', null, lowLabel), h('span', null, highLabel)),
  ];
}

function scaleQuestion(name, legend, value, onChange, lowLabel, highLabel) {
  return h('fieldset', { class: 'q autoscroll' },
    h('legend', null, legend),
    scale(name, legend, value, onChange, lowLabel, highLabel));
}

// 「|」の位置でだけ折り返せるようにする
function phrases(text) {
  return text.split('|').flatMap((part, i) => (i ? [h('wbr'), part] : [part]));
}

function copyPhrases(text) {
  return phrases(COPY_PHRASES.find((t) => t.replace(/[|]/g, '') === text) || text);
}

function rotate(items, offset) {
  return items.slice(offset).concat(items.slice(0, offset));
}

function productImages(cls) {
  return h('div', { class: 'img-row' },
    productOrder.map((p) => h('img', { class: cls, src: PRODUCTS[p].img, alt: PRODUCTS[p].imgAlt })));
}

const productNames = () => productOrder.map((p) => PRODUCTS[p].name).join('と');

// ---------- pages ----------

const pages = {
  consent: () => ({
    hideProgress: true,
    body: [
      h('div', { class: 'hero' },
        h('span', { class: 'eyebrow' }, 'ご協力のお願い'),
        h('h1', null, '16Personalitiesと', h('br'), h('span', { class: 'grad' }, '購買に関するアンケート')),
        productImages('hero-img'),
        h('p', null, productOrder.length > 1
          ? '卒業論文の調査にご協力ください。2つの商品について、それぞれ4つの場面を想像して、広告コピーで買いたい気持ちがどれくらい高まるかに答えていただきます。'
          : '卒業論文の調査にご協力ください。4つの場面を想像して、広告コピーで買いたい気持ちがどれくらい高まるかに答えていただきます。'),
        h('p', null, '回答のお礼に、最後に、あなたの回答の分析結果をお見せします。'),
        h('div', { class: 'chips-row' },
          h('span', { class: 'chip-info' }, '所要時間 約' + SET.minutes + '分'),
          h('span', { class: 'chip-info' }, '匿名・氏名やメール不要'),
          h('span', { class: 'chip-info' }, '回答後に分析結果を表示'))),
      h('div', { class: 'card' },
        h('h3', null, 'はじめる前に'),
        h('p', { class: 'small' }, 'このアンケートは、' + UNIVERSITY + 'の卒業論文のための調査です。16Personalitiesの診断結果と、買い物や広告の感じ方について聞きます。対象は18歳以上の方です。'),
        h('p', { class: 'small' }, '16Personalitiesは、一般に「MBTI診断」と呼ばれることの多い無料の性格診断です（建築家、仲介者などのタイプが出るものです）。正式なMBTIとは別のものです。'),
        h('p', { class: 'small' }, '所要時間は約' + SET.minutes + '分です（16Personalitiesの診断を今から受ける場合は約' + SET.minutesWithTest + '分）。回答は匿名で、氏名やメールアドレスは集めません。回答は統計的に処理し、卒業論文に使用します。また、全員の平均の割合と人数だけを、回答した方の結果ページに表示します（1人ずつの回答は表示しません）。'),
        h('p', { class: 'small' }, '回答は任意で、途中でやめても不利益はありません。送信後は匿名のため、個別の削除ができません。'),
        h('p', { class: 'small muted' }, '問い合わせ先：' + AUTHOR + '（' + CONTACT + '）')),
    ],
    nextLabel: '同意してスタート →',
    extraAfter: h('button', { type: 'button', class: 'btn-link',
      onclick: () => showEnd('同意いただけない場合は、このページを閉じてください。ご覧いただきありがとうございました。') }, '同意しない'),
    validate: () => { state.a.consent = true; return null; },
  }),

  experience: () => ({
    body: [
      h('h2', null, 'まずは、16Personalities（MBTI診断）について'),
      optionCards('experience', '16Personalities（いわゆるMBTI診断）を受けたことがありますか。',
        EXPERIENCE, state.a.experience, (v) => { state.a.experience = v; }),
    ],
    validate: () => {
      if (!state.a.experience) return '選択してください。';
      if (state.a.experience === 'none') {
        showEnd('ご協力ありがとうございました。このアンケートは16Personalitiesの結果を使うため、ここで終了です。');
        return 'stop';
      }
      return null;
    },
  }),

  guide: () => ({
    body: [
      h('h2', null, '診断を受けてから戻ってきてね'),
      h('p', null, '別のタブで次のページを開き、診断を受けてください。結果のページは開いたままにして、このページに戻ってください。'),
      h('a', { class: 'test-link', href: TEST_URL, target: '_blank', rel: 'noopener noreferrer' }, '16Personalities 無料性格診断テストを開く ↗'),
      h('p', { class: 'muted' }, 'このページは閉じずにそのままにしておいてください。'),
    ],
    nextLabel: '診断を受けた！',
    validate: () => null,
  }),

  profile: () => ({
    body: [
      h('h2', null, 'あなたについて教えてください'),
      PROFILE.map(([key, label, options]) =>
        chips(key, label, options.map((o) => [o, o]), state.a[key], (v) => { state.a[key] = v; })),
    ],
    validate: () => (PROFILE.every(([key]) => state.a[key]) ? null : 'すべての質問に答えてください。'),
  }),

  adIntro: () => ({
    body: [
      h('h2', null, 'これからの質問について'),
      h('p', null, 'これから、' + productNames() + 'についてお聞きします。'),
      h('p', null, (productOrder.length > 1 ? '商品ごとに' : '') + '4つの場面を想像していただき、それぞれの広告コピーで、買いたい気持ちがどれくらい高まるかをお答えください。どの場面でも、その商品を買おうとしていて、お金は十分にあることを前提にお答えください。'),
      productImages('product-img'),
      h('p', null, h('b', null, productOrder.length > 1
        ? '商品ごとの4つのコピーは、すべてその同じ1つの商品に付いているものです。'
        : '4つのコピーは、すべてこの同じ1つの商品に付いているものです。')),
      h('p', null, '各ページでは、まず【今回の状況】を読んでから、コピーへの回答を選んでください。'),
    ],
    nextLabel: '1つめの場面へ →',
    validate: () => null,
  }),

  interest: () => ({
    body: [
      h('h2', null, 'おつかれさま！あと少しです'),
      h('p', null, 'ふだん、次の商品にどれくらい関心がありますか。'),
      productOrder.map((p) => scaleQuestion('interest-' + p, PRODUCTS[p].interestLabel, state.a.interest[p],
        (n) => { state.a.interest[p] = n; }, '1：全くない', '7：とてもある')),
    ],
    validate: () => (productOrder.every((p) => state.a.interest[p]) ? null : 'すべての商品に答えてください。'),
  }),

  mbti: () => ({
    body: [
      h('h2', null, 'あなたの16Personalitiesの結果は？'),
      h('fieldset', { class: 'q' },
        h('legend', null, '診断タイプ'),
        h('div', { class: 'type-grid' },
          TYPES.map(([code, name]) => h('label', { class: 'type-tile', 'data-g': code[1] === 'N' ? 'N' + code[2] : 'S' + code[3] },
            h('input', { type: 'radio', name: 'type', value: code, checked: state.a.type === code,
              onchange: (e) => { state.a.type = code; afterAnswer(e.target); } }),
            h('span', null, h('b', null, code), h('small', null, name))))),
        h('div', { class: 'chips unknown-chip' }, h('label', { class: 'chip' },
          h('input', { type: 'radio', name: 'type', value: 'unknown', checked: state.a.type === 'unknown',
            onchange: (e) => { state.a.type = 'unknown'; afterAnswer(e.target); } }),
          h('span', null, '覚えていない')))),
      chips('identity', 'タイプ末尾の文字', [['A', '-A'], ['T', '-T'], ['unknown', '覚えていない']],
        state.a.identity, (v) => { state.a.identity = v; }),
      h('fieldset', null,
        h('legend', null, '5つの指標の%（分かる人だけ）'),
        h('p', { class: 'muted small' }, '結果ページを見られる人だけ、自分の側に表示された数字（50〜100）を入力してください。分からなければ空欄で構いません。'),
        h('div', { class: 'axes' },
          AXES.map(([key, label]) => h('label', null, label,
            h('input', { type: 'number', inputmode: 'numeric', min: '50', max: '100', step: '1', placeholder: '50〜100',
              value: state.a.axes[key] ?? '', oninput: (e) => {
                state.a.axes[key] = e.target.value === '' ? undefined : Number(e.target.value);
              } }))))),
      chips('lastTaken', '最後に受けた時期', ['今日', '3か月以内', '1年以内', '1年以上前', '覚えていない'].map((o) => [o, o]),
        state.a.lastTaken, (v) => { state.a.lastTaken = v; }),
    ],
    validate: () => {
      if (!state.a.type || !state.a.identity || !state.a.lastTaken) return '診断タイプ、末尾の文字、受けた時期を選んでください。';
      for (const [key] of AXES) {
        const v = state.a.axes[key];
        if (v !== undefined && !(Number.isInteger(v) && v >= 50 && v <= 100)) return '%は50〜100の整数で入力してください（分からなければ空欄）。';
      }
      return null;
    },
  }),

  belief: () => {
    const rows = BELIEF.slice();
    rows.splice(2, 0, ['check2', '確認のため、この行は「3」を選んでください']);
    return {
      body: [
        h('h2', null, 'さいごの質問！'),
        h('p', null, '次の文はどれくらい当てはまりますか。'),
        rows.map(([key, label]) => scaleQuestion('belief-' + key, label, state.a.belief[key],
          (n) => { state.a.belief[key] = n; }, '1：全く当てはまらない', '7：とても当てはまる')),
      ],
      nextLabel: '送信して分析結果を見る',
      validate: () => (rows.every(([key]) => state.a.belief[key]) ? null : 'すべての行に答えてください。'),
    };
  },
};

const HIDDEN_MESSAGE = '広告コピーが表示されていません。広告ブロックを切るか、別のブラウザで開き直してください。コピーが見えない状態では、次へ進めません。';

// コピーの文が本当に画面に出ているか（広告ブロックなどで消えていないか）
function copiesVisible(expected) {
  const els = Array.from(app.querySelectorAll('.copy-words'));
  return els.length === expected && els.every((el) => {
    const box = el.getBoundingClientRect();
    if (!el.textContent.trim() || box.width < 40 || box.height < 10) return false;
    for (let n = el; n && n !== app; n = n.parentElement) {
      const st = getComputedStyle(n);
      if (st.display === 'none' || st.visibility !== 'visible' || Number(st.opacity) === 0) return false;
    }
    return true;
  });
}

function scenePage(productIndex, index) {
  const pKey = productOrder[productIndex];
  const product = PRODUCTS[pKey];
  const sceneKey = ORDERS[state.order][index];
  const rows = rotate(COPY_IDS, index).map((id) => ({ id, text: product.copies[id] }));
  if (index === 1 && pKey === CHECK_PRODUCT) rows.splice(2, 0, CHECK_ROW);
  state.a.rowOrder[pKey][sceneKey] = rows.map((r) => r.id);
  const ratings = state.a.ratings[pKey][sceneKey] || (state.a.ratings[pKey][sceneKey] = {});
  const multi = productOrder.length > 1;
  const lead = index === 0
    ? (multi && productIndex > 0 ? 'ここからは、2つめの商品です。' : '') + product.intro
    : 'この商品を買おうとしていること、お金は十分にあること、商品（' + product.name + '）と広告コピーは同じです。次の場面について答えてください。';
  return {
    body: [
      h('div', { class: 'scene-head' },
        h('div', null,
          h('div', { class: 'scene-no' }, (multi ? product.name + '　' : '') + '場面 ' + (index + 1) + ' / 4'),
          h('div', { class: 'scene-title' }, SCENE_LABELS[sceneKey]))),
      h('p', { class: 'lead' }, lead),
      index === 0
        ? h('img', { class: 'product-img', src: product.img, alt: product.imgAlt })
        : h('div', { class: 'product-row' }, h('img', { src: product.img, alt: product.imgAlt }), h('p', null, '商品は、さっきと同じ' + product.noun + 'です')),
      h('div', { class: 'situation' }, h('strong', null, '【今回の状況】'), product.scenes[sceneKey]),
      h('p', null, h('b', null, '次の広告コピーが書かれていたら、' + product.noun + 'を買いたい気持ちはどれくらい高まりますか。')),
      // 広告ブロックに消されないよう、ad を含む名前や legend の装飾は使わない
      rows.map((r) => h('fieldset', { class: 'q autoscroll' + (r.id === 'CHECK' ? ' check-q' : ''), 'aria-labelledby': 'words-' + r.id },
        h('div', { class: 'copy-card' },
          r.id === 'CHECK' ? null : h('img', { src: product.img, alt: '' }),
          h('div', { class: 'copy-body' },
            r.id === 'CHECK' ? null : h('div', { class: 'copy-label' }, product.noun + 'の広告コピー'),
            h('div', { class: 'copy-words', id: 'words-' + r.id }, r.id === 'CHECK' ? r.text : '「' + r.text + '」'))),
        scale('r-' + pKey + '-' + sceneKey + '-' + r.id, r.text, ratings[r.id],
          (n) => { ratings[r.id] = n; }, '1：全く高まらない', '7：とても高まる'))),
    ],
    nextLabel: index < 3 ? '次の場面へ →' : (multi && productIndex === 0 ? '次の商品へ →' : '次へ →'),
    validate: () => {
      if (!copiesVisible(rows.length)) return HIDDEN_MESSAGE;
      return rows.every((r) => ratings[r.id]) ? null : 'すべてのコピーに答えてください。';
    },
  };
}

// ---------- rendering ----------

const app = document.getElementById('app');
const bar = document.getElementById('bar');
const stepLabel = document.getElementById('stepLabel');

function render() {
  const list = steps();
  const key = list[state.step];
  let page;
  let title;
  if (key.startsWith('scene:')) {
    const [, pi, si] = key.split(':').map(Number);
    page = scenePage(pi, si);
    title = (productOrder.length > 1 ? PRODUCTS[productOrder[pi]].name + ' ' : '') + '場面 ' + (si + 1);
  } else {
    page = pages[key]();
    title = PAGE_TITLES[key];
  }
  bar.style.width = Math.round((state.step / list.length) * 100) + '%';
  stepLabel.textContent = page.hideProgress ? '' : (state.step + ' / ' + (list.length - 1) + '　' + title);

  const error = h('p', { class: 'error', role: 'alert' });
  const next = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
    const msg = page.validate();
    if (msg === 'stop') return;
    if (msg) {
      error.textContent = '';
      requestAnimationFrame(() => { error.textContent = msg; });
      const firstEmpty = Array.from(app.querySelectorAll('.q')).find((el) => !el.querySelector('input:checked'));
      if (firstEmpty) firstEmpty.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    recordTiming(key);
    if (state.step === list.length - 1) { submit(); return; }
    state.step += 1;
    render();
  } }, page.nextLabel || '次へ →');
  const back = state.step > 0
    ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { recordTiming(key); state.step -= 1; render(); } }, '←')
    : null;

  const isHero = key === 'consent';
  const content = isHero
    ? h('div', { class: 'page' }, page.body, error, h('div', { class: 'nav' }, next), h('div', { class: 'hero-foot' }, page.extraAfter))
    : h('section', { class: 'card page' }, page.body, error, h('div', { class: 'nav' }, back, next));
  app.replaceChildren(content);
  if (app.querySelectorAll('.q').length && !Array.from(app.querySelectorAll('.q')).some((el) => !el.querySelector('input:checked'))) {
    next.classList.add('ready');
  }
  app.querySelectorAll('.q').forEach((el) => { if (el.querySelector('input:checked')) el.classList.add('done'); });
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
  // 表示のアニメーションが終わったころに、コピーが見えているかを確かめる
  if (key.startsWith('scene:')) {
    setTimeout(() => {
      const n = content.querySelectorAll('fieldset.q').length;
      if (content.isConnected && !copiesVisible(n)) {
        content.prepend(h('p', { class: 'error', role: 'alert' }, HIDDEN_MESSAGE));
      }
    }, 1200);
  }
}

function recordTiming(key) {
  const now = Date.now();
  state.timings[key] = (state.timings[key] || 0) + (now - state.stepStartedAt);
  state.stepStartedAt = now;
}

function showEnd(message) {
  state.submitted = true;
  bar.style.width = '100%';
  stepLabel.textContent = '';
  app.replaceChildren(h('section', { class: 'card page' }, h('h2', null, 'ありがとうございました'), h('p', null, message)));
}

// ---------- submit ----------

async function submit() {
  showLoading();
  const checkScene = ORDERS[state.order][1];
  const answers = Object.assign({}, state.a, {
    set: setKey,
    products: productOrder,
    order: state.order,
    check1: state.a.ratings[CHECK_PRODUCT] ? state.a.ratings[CHECK_PRODUCT][checkScene].CHECK : null,
    timings: state.timings,
    startedAt: state.startedAt,
    submittedAt: new Date().toISOString(),
    mobile: window.matchMedia('(pointer: coarse)').matches,
  });

  const minWait = new Promise((r) => setTimeout(r, reduceMotion ? 0 : 1800));
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/responses', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ version: VERSION, answers }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.submitted = true;
    await minWait;
    showResult();
  } catch (e) {
    render();
    app.querySelector('.btn-primary').textContent = 'もう一度送信する';
    app.querySelector('.error').textContent = '送信できませんでした。通信環境を確認して、もう一度押してください。';
  }
}

function showLoading() {
  bar.style.width = '100%';
  stepLabel.textContent = '';
  window.scrollTo(0, 0);
  app.replaceChildren(h('div', { class: 'loading page' },
    h('div', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
    h('h2', null, 'あなたの反応を分析中…'),
    h('p', { class: 'muted' }, nRatings() + '個の回答から、性格と状況の割合を計算しています')));
}

// ---------- result ----------

/*
 * 商品ごとに16個の評価（4コピー×4場面）のばらつきを3つに分け、商品をまたいで足し合わせる。
 *   性格: 自分のタイプ向けコピーを、他のコピーより一貫して高く評価した分（低い場合は0）
 *   好み: それ以外の、場面が変わっても変わらないコピーの好み
 *   状況: 場面によって評価が変わった分（場面全体の上下＋場面ごとの好みの入れ替わり）
 * 二元配置の平方和: SS_copy = 4Σ(コピー平均-全体平均)^2、SS_scene = 4Σ(場面平均-全体平均)^2、
 * SS_int = Σ(評価-コピー平均-場面平均+全体平均)^2。
 * タイプ向けコピーとその他3つの差 d の対比平方和は 3d^2（SS_copy の一部）。
 * 平方和のままだと自由度の多い「状況」が大きく出るため、それぞれ自由度で割ってから比べる（2026-11-24修正）。
 *   性格 1、好み 2（タイプ向けの差が0以下またはタイプ不明なら、コピー差すべてを好みとして 3）、状況 3+9=12。
 * 商品どうしの平均の差（どちらの商品をより買いたいか）は割合に含めない。
 */
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function decompose(pKey, myCopy) {
  const sceneKeys = ORDERS.A;
  const r = COPY_IDS.map((id) => sceneKeys.map((s) => state.a.ratings[pKey][s][id]));
  const m = mean(r.flat());
  const copyMeans = r.map(mean);
  const sceneMeans = sceneKeys.map((_, j) => mean(r.map((row) => row[j])));
  const ssCopy = 4 * copyMeans.reduce((a, x) => a + (x - m) ** 2, 0);
  const ssScene = 4 * sceneMeans.reduce((a, x) => a + (x - m) ** 2, 0);
  let ssInt = 0;
  r.forEach((row, i) => row.forEach((x, j) => { ssInt += (x - copyMeans[i] - sceneMeans[j] + m) ** 2; }));
  let msPerson = 0;
  let msPref = ssCopy / 3;
  if (myCopy) {
    const k = COPY_IDS.indexOf(myCopy);
    const d = copyMeans[k] - mean(copyMeans.filter((_, i) => i !== k));
    if (d > 0) {
      msPerson = 3 * d * d;
      msPref = Math.max(0, ssCopy - msPerson) / 2;
    }
  }
  return { msPerson, msPref, msSitu: (ssScene + ssInt) / 12, copyMeans, sceneMeans };
}

function computeResult() {
  const code = state.a.type;
  const myCopy = code && code !== 'unknown' ? code[1] + code[2] : null;
  const per = {};
  let msPerson = 0; let msPref = 0; let msSitu = 0;
  productOrder.forEach((p) => {
    per[p] = decompose(p, myCopy);
    msPerson += per[p].msPerson; msPref += per[p].msPref; msSitu += per[p].msSitu;
  });
  const total = msPerson + msPref + msSitu;
  let person = 0; let pref = 0; let situ = 0;
  if (total > 1e-9) {
    person = Math.round((msPerson / total) * 100);
    situ = Math.min(100 - person, Math.round((msSitu / total) * 100)); // 端数で合計が100を超えないようにする
    pref = 100 - person - situ;
  }
  const sceneKeys = ORDERS.A;
  const sceneMeans = sceneKeys.map((_, j) => mean(productOrder.map((p) => per[p].sceneMeans[j])));
  return { total, person, pref, situ, myCopy, per, sceneMeans, sceneKeys };
}

function resultTitle(res) {
  if (res.total <= 1e-9) return 'どの場面でも同じ評価でした';
  const top = Math.max(res.person, res.pref, res.situ);
  if (top === res.person) return '性格どおりの反応が、いちばん大きく出ました';
  if (top === res.situ) return '状況による変化が、いちばん大きく出ました';
  return '自分の好みが、いちばん大きく出ました';
}

function resultComment(res) {
  if (res.total <= 1e-9) return 'すべてのコピー・場面に同じ点数を付けていたため、割合は計算できませんでした。';
  const top = Math.max(res.person, res.pref, res.situ);
  if (top === res.person) {
    const names = productOrder.filter((p) => res.per[p].msPerson > 0).map((p) => PRODUCTS[p].name).join('と');
    return (productOrder.length > 1 ? names + 'では、' : '') + '4場面を平均すると、あなたのタイプに向けて作ったコピーに、ほかのコピーの平均より高い点数を付けていました。';
  }
  if (top === res.situ) return '同じコピーでも、時間がない・疲れている・友達といる、といった場面によって、付けた点数が動いていました。';
  if (!res.myCopy) return '場面が変わっても、コピーの好みがはっきりしていました。';
  return '場面が変わっても、コピーの好みがはっきりしていました。その好みの多くは、想定したタイプの違いだけでは説明できないものでした。';
}

function countUp(el, target) {
  if (reduceMotion) { el.textContent = target + '%'; return; }
  const start = performance.now();
  const dur = 1200;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + '%';
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// 公開されている平均の割合と人数だけを取得する。10人未満なら null
async function fetchAverage() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/survey_averages?select=n,person,pref,situ&product_set=eq.' + setKey,
      { headers: { 'apikey': SUPABASE_KEY }, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return (await res.json())[0] || null;
  } finally {
    clearTimeout(timer);
  }
}

function compareRow(label, v) {
  const segs = [['seg-person', v.person], ['seg-pref', v.pref], ['seg-situ', v.situ]].map(([cls, w]) => {
    const seg = h('div', { class: cls });
    seg.style.width = w + '%';
    return seg;
  });
  return h('div', { class: 'compare-row' },
    h('div', { class: 'compare-label' }, h('b', null, label),
      h('span', null, '性格 ' + v.person + '%　好み ' + v.pref + '%　状況 ' + v.situ + '%')),
    h('div', { class: 'split', 'aria-hidden': 'true' }, segs));
}

async function fillAverage(box, res) {
  let avg;
  try {
    avg = await fetchAverage();
  } catch (e) {
    box.replaceChildren(h('p', { class: 'muted' }, '平均を読み込めませんでした。あなたの回答は送信済みです。'));
    return;
  }
  if (!avg) {
    box.replaceChildren(h('p', { class: 'muted' }, '集計中です。10人分の回答が集まると表示されます。'));
    return;
  }
  box.replaceChildren(
    res.total > 1e-9 ? compareRow('あなた', res) : '',
    compareRow('全員の平均（' + avg.n + '人）', avg),
    h('p', { class: 'muted small' }, '平均は10人ごとに更新するため、あなたの回答はまだ含まれていないことがあります。表示しているのは平均の割合と人数だけで、1人ずつの回答が、ほかの回答者に表示されることはありません。タイプが分からない方や、確認の質問を2つとも間違えた方などは除いています。集計の途中の数字です。'));
}

function showResult() {
  bar.style.width = '100%';
  stepLabel.textContent = '分析結果';
  const res = computeResult();
  const typeName = TYPES.find(([c]) => c === state.a.type);
  const multi = productOrder.length > 1;

  const pPerson = h('b', null, '0%');
  const pSitu = h('b', null, '0%');
  const segs = [['seg-person', res.person], ['seg-pref', res.pref], ['seg-situ', res.situ]].map(([cls, v]) => {
    const seg = h('div', { class: cls });
    seg.dataset.w = v;
    return seg;
  });
  const split = h('div', { class: 'split', role: 'img',
    'aria-label': '性格' + res.person + '%、自分の好み' + res.pref + '%、状況' + res.situ + '%' }, segs);

  const fills = [];
  const copyBlocks = productOrder.map((p) => h('div', { class: 'bars-block' },
    multi ? h('h3', null, PRODUCTS[p].name) : null,
    h('div', { class: 'bars' }, COPY_IDS.map((id, i) => {
      const fill = h('div', { class: 'fill' });
      fill.dataset.w = Math.round((res.per[p].copyMeans[i] / 7) * 100);
      fills.push(fill);
      return h('div', { class: 'barrow' + (id === res.myCopy ? ' mine' : '') },
        h('div', { class: 'lbl' }, h('span', null, (id === res.myCopy ? '★ ' : '') + '「' + PRODUCTS[p].copies[id] + '」'),
          h('span', null, res.per[p].copyMeans[i].toFixed(1))),
        h('div', { class: 'track' }, fill));
    }))));

  const sceneSorted = res.sceneKeys.map((s, j) => [s, res.sceneMeans[j]]).sort((a, b) => b[1] - a[1]);
  const hi = sceneSorted[0];
  const lo = sceneSorted[sceneSorted.length - 1];

  // S/N（行）×T/F（列）の表。コピーの作り方をそのまま見せる
  const designTables = productOrder.map((p) => h('table', { class: 'matrix' },
    h('caption', null, PRODUCTS[p].name),
    h('thead', null, h('tr', null,
      h('td', null),
      h('th', { scope: 'col' }, h('b', null, 'T'), '根拠で選ぶ'),
      h('th', { scope: 'col' }, h('b', null, 'F'), '気持ちで選ぶ'))),
    h('tbody', null, [['S', '具体的な|こと'], ['N', '新しさ・|想像']].map(([sn, label]) => h('tr', null,
      h('th', { scope: 'row' }, h('b', null, sn), phrases(label)),
      ['T', 'F'].map((tf) => {
        const id = sn + tf;
        const isMine = id === res.myCopy;
        return h('td', { class: isMine ? 'mine' : null },
          copyPhrases(PRODUCTS[p].copies[id]),
          isMine ? h('span', { class: 'mine-label' }, 'あなた（' + id + '）') : null);
      }))))));

  const averageBox = h('div', { 'aria-live': 'polite' }, h('p', { class: 'muted' }, '読み込み中…'));

  app.replaceChildren(
    h('section', { class: 'card page result-hero' },
      h('span', { class: 'eyebrow' }, 'あなたの回答の分析結果'),
      h('div', { class: 'result-type grad' }, resultTitle(res)),
      typeName ? h('span', { class: 'type-badge' }, typeName[0] + '（' + typeName[1] + '）') : null,
      h('div', { class: 'big-pct' },
        h('div', { class: 'bp-person' }, pPerson, '性格'),
        h('div', { class: 'bp-situ' }, pSitu, '状況')),
      split,
      h('div', { class: 'legend' },
        h('span', null, h('i', { class: 'seg-person' }), '性格どおり ' + res.person + '%'),
        h('span', null, h('i', { class: 'seg-pref' }), '自分の好み ' + res.pref + '%'),
        h('span', null, h('i', { class: 'seg-situ' }), '状況しだい ' + res.situ + '%')),
      h('p', { class: 'result-note' }, resultComment(res)),
      !res.myCopy ? h('p', { class: 'muted small' }, 'タイプが分からなかったため、性格どおりかどうかは分析していません。') : null),

    h('section', { class: 'card page' },
      h('h2', null, '全員の平均とくらべる'),
      averageBox),

    h('section', { class: 'card page' },
      h('h2', null, 'コピーごとの「買いたい気持ち」の高まり'),
      res.myCopy ? h('p', { class: 'muted small' }, '★が、あなたのタイプ（' + res.myCopy + '）に響くことを想定したコピーです。数字は4場面の平均（7点満点）。') : null,
      copyBlocks,
      res.total > 1e-9 ? h('div', { class: 'scene-stats' },
        h('div', null, 'いちばん高まった場面', h('b', null, SCENE_LABELS[hi[0]])),
        h('div', null, 'いちばん高まらなかった場面', h('b', null, SCENE_LABELS[lo[0]]))) : null),

    h('section', { class: 'card page' },
      h('h2', null, phrases('この調査で使った|コピーについて')),
      h('p', null, '4つのコピーは、16Personalitiesの2つの軸を組み合わせて作りました。'),
      designTables,
      h('p', { class: 'small' }, 'Sは具体的な事実や身近な場面、Nは新しさや想像。Tは数字や技術などの根拠、Fは気持ちに訴える言葉にしています。それぞれのタイプの人に響くと想定していますが、本当にそうなるか、場面のほうが大きく効くのかを卒業論文で調べます。')),

    h('section', { class: 'card page' },
      h('h3', null, 'この結果について'),
      h('p', { class: 'muted small' }, 'この割合は、あなたが付けた' + nRatings() + '個の点数のばらつきを、' + (multi ? '商品ごとに' : '') + '「タイプ向けコピーを一貫して高く評価した分（性格）」「タイプとは関係なく一貫した好み（自分の好み）」「場面によって変わった分（状況）」に分け、それぞれの質問数などの違いをそろえて比べたものです。性格を診断するものではなく、今回の回答を分析した結果です。1人分の回答なので、目安としてご覧ください。卒業論文では回答者全体の傾向を別に分析します。'),
      h('p', { class: 'muted small' }, '回答は1人1回でお願いします。全体の結果は、集計後に公開する予定です。')),
  );
  window.scrollTo(0, 0);
  fillAverage(averageBox, res);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    segs.forEach((s) => { s.style.width = s.dataset.w + '%'; });
    fills.forEach((f) => { f.style.width = f.dataset.w + '%'; });
    countUp(pPerson, res.person);
    countUp(pSitu, res.situ);
  }));
}

window.addEventListener('beforeunload', (e) => {
  if (state.step > 0 && !state.submitted) { e.preventDefault(); e.returnValue = ''; }
});

render();
