'use strict';

/*
 * 卒論アンケートサイト（2026-11-24）
 * 質問の文言・順序・確認の行は create_form.gs（2026-11-15版）に合わせている。
 * 違い: 場面の順番は6通りからランダムに割り当てる。最後に結果とコピーの説明を出す。
 * 回答は Supabase の responses テーブルに送る（書き込み専用。ブラウザからは読めない）。
 *
 * 商品の組み合わせは URL で切り替える:
 *   （なし）      … ワイヤレスイヤホンのみ
 *   ?p=both       … ドリンクとワイヤレスイヤホン（商品の順はランダム）
 * 2026-11-25 web-4: 場面を3つ（余裕・急ぎ・疲れ）にし、順番を6通りからランダムにした。5つの%の入力も削除。
 * 保存形式 web-3 以降: ratings[商品][場面][コピーID]、interest[商品]。形は web-2 と同じで、聞き方が違う
 *   2026-11-24 収入・自由に使えるお金・住まいの質問を削除（お金が効く設計ではないため）。
 *   （web-2「買いたいと思うか」→ web-3「買いたい気持ちがどれくらい高まるか」。2026-11-24変更）。
 */

const SUPABASE_URL = 'https://ljsotmcpaqdlvmysvnsj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fN0wj547S7tuJyVvwKlcEg_3s1q4kyf';
const VERSION = 'web-4';

const UNIVERSITY = '名城大学';
const AUTHOR = '西垣優';
const CONTACT = 'yuurise2424@gmail.com';
const TEST_URL = 'https://www.16personalities.com/ja/%E6%80%A7%E6%A0%BC%E8%A8%BA%E6%96%AD%E3%83%86%E3%82%B9%E3%83%88';

const COPY_IDS = ['ST', 'SF', 'NT', 'NF'];
const CHECK_ROW = { id: 'CHECK', text: '確認のため、この行は「5」を選んでください' };

const SCENE_LABELS = {
  base: '時間に余裕があるとき',
  rush: '時間がないとき',
  tired: 'とても疲れているとき',
};
const SCENE_KEYS = ['base', 'rush', 'tired'];
const SCENE_ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map((o) => o.map((i) => SCENE_KEYS[i]));

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
  earphone: { products: ['earphone'], minutes: 4, minutesWithTest: 14 },
  both: { products: ['drink', 'earphone'], minutes: 5, minutesWithTest: 15 },
};

const TYPES = [
  ['INTJ', '建築家'], ['INTP', '論理学者'], ['ENTJ', '指揮官'], ['ENTP', '討論者'],
  ['INFJ', '提唱者'], ['INFP', '仲介者'], ['ENFJ', '主人公'], ['ENFP', '運動家'],
  ['ISTJ', '管理者'], ['ISFJ', '擁護者'], ['ESTJ', '幹部'], ['ESFJ', '領事'],
  ['ISTP', '巨匠'], ['ISFP', '冒険家'], ['ESTP', '起業家'], ['ESFP', 'エンターテイナー'],
];
const PROFILE = [
  ['age', '年齢', ['18〜19歳', '20〜22歳', '23〜25歳', '26〜29歳', '30〜39歳', '40歳以上']],
  ['gender', '性別', ['男性', '女性', 'その他', '回答しない']],
  ['status', '現在の立場', ['大学生・大学院生', '専門学校生など', '会社員・公務員', 'パート・アルバイト', 'その他']],
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
  adIntro: '説明', interest: '関心', mbti: '診断結果', belief: '最後',
};

// ---------- state ----------

const setKey = new URLSearchParams(location.search).get('p') === 'both' ? 'both' : 'earphone';
const SET = SETS[setKey];
const productOrder = SET.products.length > 1 && Math.random() < 0.5
  ? SET.products.slice().reverse() : SET.products.slice();

const state = {
  order: SCENE_ORDERS[Math.floor(Math.random() * SCENE_ORDERS.length)],
  a: { ratings: {}, rowOrder: {}, interest: {}, belief: {} },
  step: 0,
  timings: {},
  stepStartedAt: Date.now(),
  startedAt: new Date().toISOString(),
  submitted: false,
};
productOrder.forEach((p) => { state.a.ratings[p] = {}; state.a.rowOrder[p] = {}; });

const nRatings = () => productOrder.length * COPY_IDS.length * SCENE_KEYS.length;

function steps() {
  const list = ['consent', 'experience'];
  if (state.a.experience === 'retake' || state.a.experience === 'new') list.push('guide');
  list.push('profile', 'adIntro');
  productOrder.forEach((p, pi) => { for (let s = 0; s < SCENE_KEYS.length; s++) list.push('scene:' + pi + ':' + s); });
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
        h('p', null, '卒業論文の調査にご協力ください。' + (productOrder.length > 1 ? '2つの商品について、それぞれ' : '') + '3つの場面を想像して、広告コピーで買いたい気持ちがどれくらい高まるかに答えていただきます。'),
        h('p', null, '回答のお礼に、最後にあなたの回答の分析結果をお見せします。'),
        h('div', { class: 'chips-row' },
          h('span', { class: 'chip-info' }, '所要時間 約' + SET.minutes + '分'),
          h('span', { class: 'chip-info' }, '匿名・氏名やメール不要'),
          h('span', { class: 'chip-info' }, '回答後に分析結果を表示'))),
      h('div', { class: 'card' },
        h('h3', null, '始める前に'),
        h('p', { class: 'small' }, 'このアンケートは、' + UNIVERSITY + 'の卒業論文のための調査です。16Personalitiesの診断結果と、買い物や広告の感じ方について聞きます。対象は18歳以上の方です。'),
        h('p', { class: 'small' }, '16Personalitiesは、一般に「MBTI診断」と呼ばれることの多い無料の性格診断です（建築家、仲介者などのタイプが出るものです）。正式なMBTIとは別のものです。'),
        h('p', { class: 'small' }, '所要時間は約' + SET.minutes + '分です（16Personalitiesの診断を今から受ける場合は約' + SET.minutesWithTest + '分）。回答は匿名で、氏名やメールアドレスは集めません。回答は統計的に処理し、卒業論文に使用します。また、全員の平均の割合と人数だけを、回答した方の結果ページに表示します（1人ずつの回答は表示しません）。'),
        h('p', { class: 'small' }, '回答は任意で、途中でやめても不利益はありません。送信後は匿名のため、個別の削除ができません。'),
        h('p', { class: 'small muted contact' }, '問い合わせ先：' + AUTHOR + '（' + CONTACT + '）')),
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
      h('p', null, (productOrder.length > 1 ? '商品ごとに' : '') + '3つの場面を想像していただき、それぞれの広告コピーで、買いたい気持ちがどれくらい高まるかをお答えください。どの場面でも、その商品を買おうとしていて、お金は十分にあることを前提にお答えください。'),
      productImages('product-img'),
      h('p', null, h('b', null, productOrder.length > 1
        ? '商品ごとの4つのコピーは、すべてその同じ1つの商品に付いているものです。'
        : '4つのコピーは、すべてこの同じ1つの商品に付いているものです。')),
      h('p', null, '各ページでは、まず【今回の状況】を読んでから、コピーへの回答を選んでください。'),
    ],
    nextLabel: '1つ目の場面へ →',
    validate: () => null,
  }),

  interest: () => ({
    body: [
      h('h2', null, 'お疲れさま！あと少しです'),
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
      chips('lastTaken', '最後に受けた時期', ['今日', '3か月以内', '1年以内', '1年以上前', '覚えていない'].map((o) => [o, o]),
        state.a.lastTaken, (v) => { state.a.lastTaken = v; }),
    ],
    validate: () => {
      if (!state.a.type || !state.a.identity || !state.a.lastTaken) return '診断タイプ、末尾の文字、受けた時期を選んでください。';
      return null;
    },
  }),

  belief: () => {
    const rows = BELIEF.slice();
    rows.splice(2, 0, ['check2', '確認のため、この行は「3」を選んでください']);
    return {
      body: [
        h('h2', null, '最後の質問！'),
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
    // .page は出始めのアニメーションで一瞬 opacity が 0 になるので、その内側だけを見る
    for (let n = el; n && n !== app && !n.classList.contains('page'); n = n.parentElement) {
      const st = getComputedStyle(n);
      if (st.display === 'none' || st.visibility !== 'visible' || Number(st.opacity) === 0) return false;
    }
    return true;
  });
}

function scenePage(productIndex, index) {
  const pKey = productOrder[productIndex];
  const product = PRODUCTS[pKey];
  const sceneKey = state.order[index];
  const rows = rotate(COPY_IDS, index).map((id) => ({ id, text: product.copies[id] }));
  if (index === 1 && pKey === CHECK_PRODUCT) rows.splice(2, 0, CHECK_ROW);
  state.a.rowOrder[pKey][sceneKey] = rows.map((r) => r.id);
  const ratings = state.a.ratings[pKey][sceneKey] || (state.a.ratings[pKey][sceneKey] = {});
  const multi = productOrder.length > 1;
  const lead = index === 0
    ? (multi && productIndex > 0 ? 'ここからは、2つ目の商品です。' : '') + product.intro
    : 'この商品を買おうとしていること、お金は十分にあること、商品（' + product.name + '）と広告コピーは同じです。次の場面について答えてください。';
  return {
    body: [
      h('div', { class: 'scene-head' },
        h('div', null,
          h('div', { class: 'scene-no' }, (multi ? product.name + '　' : '') + '場面 ' + (index + 1) + ' / ' + SCENE_KEYS.length),
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
    nextLabel: index < SCENE_KEYS.length - 1 ? '次の場面へ →' : (multi && productIndex === 0 ? '次の商品へ →' : '次へ →'),
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
  const checkScene = state.order[1];
  const answers = Object.assign({}, state.a, {
    set: setKey,
    products: productOrder,
    order: state.order.join('-'),
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
 * 商品ごとに12個の評価（4コピー×3場面）のばらつきを3つに分け、商品をまたいで足し合わせる。（2026-11-25 式を変更）
 *   性格: 自分のタイプの文字（S/N、T/F）に合うコピーを、合わないコピーより高く評価した分。2つの軸を別々に数える
 *   好み: それ以外の、場面が変わっても変わらないコピーの差（誰からも好まれやすいコピーの影響も含む）
 *   状況: 場面によって評価が変わった分（場面全体の上下＋場面ごとの好みの入れ替わり）
 * 場面の数を n=3 とすると、コピー差 SS_copy = nΣ(コピー平均-全体平均)^2（自由度3）。
 * 各軸の差 L（合う2コピーの平均 - 合わない2コピーの平均）の平方和は nL^2。L が0以下の軸は0とする。
 * 自由度で割って比べる: 性格 = Σ nL^2 / 2、好み =（SS_copy - Σ nL^2）/ 2（タイプ不明なら SS_copy / 3）、
 * 状況 =（場面＋交互作用）/ (2+6=8)。同じ式が Supabase の analysis.person_shares と 集計/make_excel.py にもある。
 * 商品どうしの平均の差（どちらの商品をより買いたいか）は割合に含めない。
 */
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function decompose(pKey, myCopy) {
  const sceneKeys = SCENE_KEYS;
  const r = COPY_IDS.map((id) => sceneKeys.map((s) => state.a.ratings[pKey][s][id]));
  const m = mean(r.flat());
  const copyMeans = r.map(mean);
  const sceneMeans = sceneKeys.map((_, j) => mean(r.map((row) => row[j])));
  const ssCopy = sceneKeys.length * copyMeans.reduce((a, x) => a + (x - m) ** 2, 0);
  const ssScene = COPY_IDS.length * sceneMeans.reduce((a, x) => a + (x - m) ** 2, 0);
  let ssInt = 0;
  r.forEach((row, i) => row.forEach((x, j) => { ssInt += (x - copyMeans[i] - sceneMeans[j] + m) ** 2; }));
  let msPerson = 0;
  let msPref = ssCopy / 3;
  const matched = [];
  if (myCopy) {
    let ss = 0;
    [0, 1].forEach((axis) => {
      const fit = copyMeans.filter((_, i) => COPY_IDS[i][axis] === myCopy[axis]);
      const other = copyMeans.filter((_, i) => COPY_IDS[i][axis] !== myCopy[axis]);
      const L = mean(fit) - mean(other);
      if (L > 1e-9) { ss += sceneKeys.length * L * L; matched.push(myCopy[axis]); }
    });
    msPerson = ss / 2;
    msPref = Math.max(0, ssCopy - ss) / 2;
  }
  return { matched, msPerson, msPref, msSitu: (ssScene + ssInt) / (COPY_IDS.length * (sceneKeys.length - 1)), copyMeans, sceneMeans };
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
  const sceneKeys = SCENE_KEYS;
  const sceneMeans = sceneKeys.map((_, j) => mean(productOrder.map((p) => per[p].sceneMeans[j])));
  return { total, person, pref, situ, myCopy, per, sceneMeans, sceneKeys };
}

function resultTitle(res) {
  if (res.total <= 1e-9) return 'どの場面でも同じ評価でした';
  const top = Math.max(res.person, res.pref, res.situ);
  if (top === res.person) return '性格どおりの反応が、いちばん大きく出ました';
  if (top === res.situ) return '状況による変化が、いちばん大きく出ました';
  return 'タイプ以外の好みが、いちばん大きく出ました';
}

function resultComment(res) {
  if (res.total <= 1e-9) return 'すべてのコピー・場面に同じ点数を付けていたため、割合は計算できませんでした。';
  const top = Math.max(res.person, res.pref, res.situ);
  if (top === res.person) {
    const parts = productOrder.filter((p) => res.per[p].matched.length)
      .map((p) => (productOrder.length > 1 ? PRODUCTS[p].name + 'では' : '') + res.per[p].matched.join('と'));
    return '3場面を平均すると、あなたのタイプの文字（' + parts.join('、') + '）に合うコピーに、合わないコピーより高い点数を付けていました。';
  }
  if (top === res.situ) return '同じコピーでも、時間がない・疲れている、といった場面によって、付けた点数が動いていました。';
  if (!res.myCopy) return '場面が変わっても、コピーの好みがはっきりしていました。';
  return '場面が変わっても、コピーの好みがはっきりしていました。その多くは、タイプの違いだけでは説明できないものでした（誰からも好まれやすいコピーの影響も含みます）。';
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
    'aria-label': '性格' + res.person + '%、タイプ以外の好み' + res.pref + '%、状況' + res.situ + '%' }, segs);

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
        h('span', null, h('i', { class: 'seg-pref' }), 'タイプ以外の好み ' + res.pref + '%'),
        h('span', null, h('i', { class: 'seg-situ' }), '状況しだい ' + res.situ + '%')),
      h('p', { class: 'result-note' }, resultComment(res)),
      !res.myCopy ? h('p', { class: 'muted small' }, 'タイプが分からなかったため、性格どおりかどうかは分析していません。') : null),

    h('section', { class: 'card page' },
      h('h2', null, '全員の平均とくらべる'),
      averageBox),

    h('section', { class: 'card page' },
      h('h2', null, 'コピーごとの「買いたい気持ち」の高まり'),
      res.myCopy ? h('p', { class: 'muted small' }, '★が、あなたのタイプ（' + res.myCopy + '）に響くことを想定したコピーです。数字は3場面の平均（7点満点）。') : null,
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
      h('p', { class: 'muted small' }, 'この割合は、あなたが付けた' + nRatings() + '個の点数のばらつきを、' + (multi ? '商品ごとに' : '') + '「タイプの文字（SかN、TかF）に合うコピーを一貫して高く評価した分（性格）」「それ以外の一貫した好み（タイプ以外の好み）」「場面によって変わった分（状況）」に分け、それぞれの質問数などの違いをそろえて比べたものです。性格を診断するものではなく、今回の回答を分析した結果です。1人分の回答なので、目安としてご覧ください。卒業論文では回答者全体の傾向を別に分析します。'),
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
