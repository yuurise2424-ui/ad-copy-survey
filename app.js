'use strict';

/*
 * 卒論アンケートサイト（ワイヤレスイヤホン1商品版、2026-11-24）
 * 質問の文言・順序・確認の行は create_form.gs（2026-11-15版）に合わせている。
 * 違い: 場面順のA/Bは生まれ月ではなくランダムに割り当てる。最後に結果と答え合わせを出す。
 * 回答は Supabase の responses テーブルに送る（書き込み専用。ブラウザからは読めない）。
 * 2026-11-24 見た目を白ベースの診断サイト風に変更（保存するデータの形は web-1 のまま）。
 */

const SUPABASE_URL = 'https://ljsotmcpaqdlvmysvnsj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fN0wj547S7tuJyVvwKlcEg_3s1q4kyf';
const VERSION = 'web-1';

const UNIVERSITY = '名城大学';
const AUTHOR = '西垣優';
const CONTACT = 'yuurise2424@gmail.com';
const TEST_URL = 'https://www.16personalities.com/ja/%E6%80%A7%E6%A0%BC%E8%A8%BA%E6%96%AD%E3%83%86%E3%82%B9%E3%83%88';
const IMG = 'earphone.webp';
const IMG_ALT = 'マットブラックのワイヤレスイヤホンと充電ケースの商品画像';

const COPIES = [
  { id: 'ST', text: '連続30時間再生、重さ4.5g', target: 'S（感覚型）× T（思考型）',
    why: '感覚型は目の前の具体的な事実を、思考型は数字で比べられる根拠を重く見る、という想定です。気持ちには触れず、数字で機能だけを伝えています。' },
  { id: 'SF', text: '移動時間が、好きな時間になる', target: 'S（感覚型）× F（感情型）',
    why: '感覚型に合う「通学・通勤」という見慣れた場面と、感情型に合う「好き」という気持ちを組み合わせています。落ち着いた心地よさを伝えるコピーです。' },
  { id: 'NT', text: '音の常識を、技術で変える', target: 'N（直観型）× T（思考型）',
    why: '直観型は新しさや可能性に、思考型は理屈や根拠に反応する、という想定です。「常識を変える」で新しさを、「技術で」で根拠を示し、数字はあえて入れていません。' },
  { id: 'NF', text: '再生した瞬間、物語が始まる', target: 'N（直観型）× F（感情型）',
    why: '直観型に合う想像の広がりと、感情型に合うわくわく感を組み合わせています。使った瞬間に何かが始まる期待を伝えるコピーです。' },
];
const CHECK_ROW = { id: 'CHECK', text: '確認のため、この行は「5」を選んでください' };

const SCENES = {
  base: { label: '時間に余裕があるとき', text: '一人で来ていて、時間には余裕があります。体調も普段通りです。' },
  rush: { label: '時間がないとき', text: '一人で来ていて、この後予定があり、売り場にいられるのはあと5分です。体調は普段通りです。' },
  friend: { label: '友達と一緒のとき', text: '友達と一緒に来ていて、時間には余裕があります。体調も普段通りです。' },
  tired: { label: 'とても疲れているとき', text: '一人で来ていて、時間には余裕があります。仕事やバイト、授業の帰りで、とても疲れています。' },
};
const ORDERS = { A: ['base', 'rush', 'friend', 'tired'], B: ['tired', 'friend', 'rush', 'base'] };

const INTRO = '次の場面を想像してください。今使っているイヤホンが壊れ、新しいものを買うつもりで家電量販店に来ました。お金は十分にあるので、値段は気にしなくて大丈夫です。売り場に、新作のワイヤレスイヤホン（下の画像）が並んでいて、下のいずれかのコピーが書かれています。それぞれを見たとき、このイヤホンを買いたいと思いますか。';
const LEAD_NEXT = '買うつもりで来ていること、お金は十分にあること、商品（ワイヤレスイヤホン）、コピーは同じです。次の場面について答えてください。';

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

const state = {
  order: Math.random() < 0.5 ? 'A' : 'B',
  a: { ratings: {}, rowOrder: {}, belief: {}, axes: {} },
  step: 0,
  timings: {},
  stepStartedAt: Date.now(),
  startedAt: new Date().toISOString(),
  submitted: false,
};

function steps() {
  const list = ['consent', 'experience'];
  if (state.a.experience === 'retake' || state.a.experience === 'new') list.push('guide');
  list.push('profile', 'adIntro', 'scene0', 'scene1', 'scene2', 'scene3', 'interest', 'mbti', 'belief');
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

function rotate(items, offset) {
  return items.slice(offset).concat(items.slice(0, offset));
}

// ---------- pages ----------

const pages = {
  consent: () => ({
    hideProgress: true,
    body: [
      h('div', { class: 'hero' },
        h('span', { class: 'eyebrow' }, 'ご協力のお願い'),
        h('h1', null, '16Personalitiesと', h('br'), h('span', { class: 'grad' }, '購買に関するアンケート')),
        h('img', { class: 'hero-img', src: IMG, alt: '' }),
        h('p', null, '卒業論文の調査にご協力ください。4つの場面を想像して、広告コピーへの印象に答えていただきます。'),
        h('p', null, '回答のお礼に、最後にあなたの反応が「性格どおり」だったか「状況しだい」だったかの結果をお見せします。'),
        h('div', { class: 'chips-row' },
          h('span', { class: 'chip-info' }, '所要時間 約5分'),
          h('span', { class: 'chip-info' }, '匿名・氏名やメール不要'),
          h('span', { class: 'chip-info' }, '回答後に結果を表示'))),
      h('div', { class: 'card' },
        h('h3', null, 'はじめる前に'),
        h('p', { class: 'small' }, 'このアンケートは、' + UNIVERSITY + 'の卒業論文のための調査です。16Personalitiesの診断結果と、買い物や広告の感じ方について聞きます。対象は18歳以上の方です。'),
        h('p', { class: 'small' }, '16Personalitiesは、一般に「MBTI診断」と呼ばれることの多い無料の性格診断です（建築家、仲介者などのタイプが出るものです）。正式なMBTIとは別のものです。'),
        h('p', { class: 'small' }, '所要時間は約5分です（16Personalitiesの診断を今から受ける場合は約15分）。回答は匿名で、氏名やメールアドレスは集めません。結果は統計的に処理し、卒業論文にのみ使用します。'),
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
      h('p', null, 'これから、ワイヤレスイヤホンについてお聞きします。'),
      h('p', null, '4つの場面を想像していただき、場面ごとでの広告コピーについての印象をお答えください。どの場面でも、買うつもりで来ていて、お金は十分にあることを前提にお答えください。'),
      h('img', { class: 'product-img', src: IMG, alt: IMG_ALT }),
      h('p', null, h('b', null, '4つのコピーは、すべてこの同じ1つのイヤホンに付いているものです。')),
      h('p', null, '各ページでは、まず【今回の状況】を読んでから、コピーへの回答を選んでください。'),
    ],
    nextLabel: '1つめの場面へ →',
    validate: () => null,
  }),

  interest: () => ({
    body: [
      h('h2', null, 'おつかれさま！あと少しです'),
      scaleQuestion('interest', 'ふだん、ワイヤレスイヤホンにどれくらい関心がありますか', state.a.interest,
        (n) => { state.a.interest = n; }, '1：全くない', '7：とてもある'),
    ],
    validate: () => (state.a.interest ? null : '選択してください。'),
  }),

  mbti: () => ({
    body: [
      h('h2', null, 'あなたの16Personalitiesの結果は？'),
      h('fieldset', { class: 'q' },
        h('legend', null, '診断タイプ'),
        h('div', { class: 'type-grid' },
          TYPES.map(([code, name]) => h('label', { class: 'type-tile', 'data-g': code[1] + code[2] },
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
      nextLabel: '送信して結果を見る',
      validate: () => (rows.every(([key]) => state.a.belief[key]) ? null : 'すべての行に答えてください。'),
    };
  },
};

function scenePage(index) {
  const sceneKey = ORDERS[state.order][index];
  const scene = SCENES[sceneKey];
  const rows = rotate(COPIES, index);
  if (index === 1) rows.splice(2, 0, CHECK_ROW);
  state.a.rowOrder[sceneKey] = rows.map((r) => r.id);
  const ratings = state.a.ratings[sceneKey] || (state.a.ratings[sceneKey] = {});
  return {
    body: [
      h('div', { class: 'scene-head' },
        h('div', null,
          h('div', { class: 'scene-no' }, '場面 ' + (index + 1) + ' / 4'),
          h('div', { class: 'scene-title' }, scene.label))),
      h('p', { class: 'lead' }, index === 0 ? INTRO : LEAD_NEXT),
      index === 0
        ? h('img', { class: 'product-img', src: IMG, alt: IMG_ALT })
        : h('div', { class: 'product-row' }, h('img', { src: IMG, alt: IMG_ALT }), h('p', null, '商品は、さっきと同じこのイヤホンです')),
      h('div', { class: 'situation' }, h('strong', null, '【今回の状況】'), scene.text),
      h('p', null, h('b', null, 'このコピーが書かれていたら、このイヤホンを買いたいと思いますか。')),
      rows.map((r) => h('fieldset', { class: 'q autoscroll' + (r.id === 'CHECK' ? ' check-q' : '') },
        h('legend', { class: 'ad' },
          r.id === 'CHECK' ? null : h('img', { src: IMG, alt: '' }),
          h('span', null,
            r.id === 'CHECK' ? null : h('span', { class: 'ad-tag' }, 'このイヤホンの広告コピー'),
            h('span', { class: 'ad-text' }, r.id === 'CHECK' ? r.text : '「' + r.text + '」'))),
        scale('r-' + sceneKey + '-' + r.id, r.id === 'CHECK' ? r.text : r.text, ratings[r.id],
          (n) => { ratings[r.id] = n; }, '1：全く買いたくない', '7：とても買いたい'))),
    ],
    nextLabel: index < 3 ? '次の場面へ →' : '次へ →',
    validate: () => (rows.every((r) => ratings[r.id]) ? null : 'すべてのコピーに答えてください。'),
  };
}

// ---------- rendering ----------

const app = document.getElementById('app');
const bar = document.getElementById('bar');
const stepLabel = document.getElementById('stepLabel');

function render() {
  const list = steps();
  const key = list[state.step];
  const page = key.startsWith('scene') ? scenePage(Number(key.slice(5))) : pages[key]();
  bar.style.width = Math.round((state.step / list.length) * 100) + '%';
  stepLabel.textContent = page.hideProgress ? '' : (state.step + ' / ' + (list.length - 1) + '　' +
    (key.startsWith('scene') ? '場面 ' + (Number(key.slice(5)) + 1) : PAGE_TITLES[key]));

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
    ? h('div', { class: 'page' }, page.body, error, h('div', { class: 'nav' }, next), h('div', { class: 'share' }, page.extraAfter))
    : h('section', { class: 'card page' }, page.body, error, h('div', { class: 'nav' }, back, next));
  app.replaceChildren(content);
  if (app.querySelectorAll('.q').length && !Array.from(app.querySelectorAll('.q')).some((el) => !el.querySelector('input:checked'))) {
    next.classList.add('ready');
  }
  app.querySelectorAll('.q').forEach((el) => { if (el.querySelector('input:checked')) el.classList.add('done'); });
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
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
  const answers = Object.assign({}, state.a, {
    order: state.order,
    check1: state.a.ratings[ORDERS[state.order][1]].CHECK,
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
    h('p', { class: 'muted' }, '16個の回答から、性格と状況の割合を計算しています')));
}

// ---------- result ----------

/*
 * 16個の評価（4コピー×4場面）のばらつきを3つに分ける。
 *   性格: 自分のタイプ向けコピーを、他のコピーより一貫して高く評価した分（低い場合は0）
 *   好み: それ以外の、場面が変わっても変わらないコピーの好み
 *   状況: 場面によって評価が変わった分（場面全体の上下＋場面ごとの好みの入れ替わり）
 * 二元配置の平方和: SS_copy = 4Σ(コピー平均-全体平均)^2、SS_scene = 4Σ(場面平均-全体平均)^2、
 * SS_int = Σ(評価-コピー平均-場面平均+全体平均)^2。
 * タイプ向けコピーとその他3つの差 d の対比平方和は 3d^2（SS_copy の一部）。
 */
function computeResult() {
  const sceneKeys = ORDERS.A;
  const ids = COPIES.map((c) => c.id);
  const r = ids.map((id) => sceneKeys.map((s) => state.a.ratings[s][id]));
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const m = mean(r.flat());
  const copyMeans = r.map(mean);
  const sceneMeans = sceneKeys.map((_, j) => mean(r.map((row) => row[j])));
  const ssCopy = 4 * copyMeans.reduce((a, x) => a + (x - m) ** 2, 0);
  const ssScene = 4 * sceneMeans.reduce((a, x) => a + (x - m) ** 2, 0);
  let ssInt = 0;
  r.forEach((row, i) => row.forEach((x, j) => { ssInt += (x - copyMeans[i] - sceneMeans[j] + m) ** 2; }));

  const code = state.a.type;
  const myCopy = code && code !== 'unknown' ? code[1] + code[2] : null;
  let ssPerson = 0;
  if (myCopy) {
    const k = ids.indexOf(myCopy);
    const others = copyMeans.filter((_, i) => i !== k);
    const d = copyMeans[k] - mean(others);
    if (d > 0) ssPerson = 3 * d * d;
  }
  const ssPref = Math.max(0, ssCopy - ssPerson);
  const ssSitu = ssScene + ssInt;
  const total = ssPerson + ssPref + ssSitu;

  let person = 0; let pref = 0; let situ = 0;
  if (total > 1e-9) {
    person = Math.round((ssPerson / total) * 100);
    situ = Math.round((ssSitu / total) * 100);
    pref = 100 - person - situ;
  }
  return { total, person, pref, situ, myCopy, copyMeans, sceneMeans, sceneKeys };
}

function resultTitle(res) {
  if (res.total <= 1e-9) return 'どんな場面でも同じ評価タイプ';
  const top = Math.max(res.person, res.pref, res.situ);
  if (top === res.person) return '性格に忠実タイプ';
  if (top === res.situ) return '状況に左右されるタイプ';
  return 'わが道を行く「自分の好み」タイプ';
}

function resultComment(res) {
  if (res.total <= 1e-9) return 'すべてのコピー・場面に同じ点数を付けていたため、割合は計算できませんでした。';
  const top = Math.max(res.person, res.pref, res.situ);
  if (top === res.person) return 'どの場面でも、あなたのタイプに向けて作ったコピーを一貫して高く評価していました。広告への反応が、性格の通りに出ています。';
  if (top === res.situ) return '同じコピーでも、時間がない・疲れている・友達といる、といった場面によって買いたい気持ちが大きく動いていました。性格よりも、そのときの状況が購買を左右しています。';
  return '場面が変わってもぶれない好みがありますが、それはあなたのタイプ向けのコピーではありませんでした。性格の型には当てはまらない、自分だけの好みで選んでいます。';
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

function showResult() {
  bar.style.width = '100%';
  stepLabel.textContent = '結果';
  const res = computeResult();
  const typeName = TYPES.find(([c]) => c === state.a.type);
  const mine = res.myCopy ? COPIES.find((c) => c.id === res.myCopy) : null;

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
  const copyBars = COPIES.map((c, i) => {
    const fill = h('div', { class: 'fill' });
    fill.dataset.w = Math.round((res.copyMeans[i] / 7) * 100);
    fills.push(fill);
    return h('div', { class: 'barrow' + (c.id === res.myCopy ? ' mine' : '') },
      h('div', { class: 'lbl' }, h('span', null, (c.id === res.myCopy ? '★ ' : '') + '「' + c.text + '」'), h('span', null, res.copyMeans[i].toFixed(1))),
      h('div', { class: 'track' }, fill));
  });

  const sceneSorted = res.sceneKeys.map((s, j) => [s, res.sceneMeans[j]]).sort((a, b) => b[1] - a[1]);
  const hi = sceneSorted[0];
  const lo = sceneSorted[sceneSorted.length - 1];

  const designs = COPIES.map((c) => {
    const isMine = c.id === res.myCopy;
    return h('div', { class: 'design' + (isMine ? ' mine' : ''), 'data-g': c.id },
      h('div', { class: 'design-head' },
        h('span', { class: 'design-tag' }, c.id),
        h('span', { class: 'design-target' }, c.target + ' を想定'),
        isMine ? h('span', { class: 'ribbon' }, 'あなたのタイプ') : null),
      h('div', { class: 'design-copy' }, '「' + c.text + '」'),
      h('p', { class: 'small' }, c.why));
  });

  app.replaceChildren(
    h('section', { class: 'card page result-hero' },
      h('span', { class: 'eyebrow' }, 'あなたの結果'),
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
      h('p', { class: 'comment' }, resultComment(res)),
      !mine ? h('p', { class: 'muted small' }, 'タイプが分からなかったため、性格どおりかどうかは判定していません。') : null),

    h('section', { class: 'card page' },
      h('h2', null, 'コピーごとの「買いたい」度'),
      mine ? h('p', { class: 'muted small' }, '★が、あなたのタイプ（' + res.myCopy + '）に響くことを想定したコピーです。数字は4場面の平均（7点満点）。') : null,
      h('div', { class: 'bars' }, copyBars),
      res.total > 1e-9 ? h('div', { class: 'scene-stats' },
        h('div', null, 'いちばん買いたくなった場面', h('b', null, SCENES[hi[0]].label)),
        h('div', null, 'いちばん買いたくなくなった場面', h('b', null, SCENES[lo[0]].label))) : null),

    h('section', { class: 'card page' },
      h('h2', null, 'この調査で使ったコピーについて'),
      h('p', null, '4つのコピーは、16Personalitiesの「感覚型(S)・直観型(N)」と「思考型(T)・感情型(F)」の組み合わせごとに、そのタイプの人に響くことを想定して作成しました。卒業論文では、この想定どおりに反応が分かれるのか、それとも場面の影響のほうが大きいのかを調べます。'),
      h('div', { class: 'designs' }, designs)),

    h('section', { class: 'card page' },
      h('h3', null, 'この結果について'),
      h('p', { class: 'muted small' }, 'この割合は、あなたが付けた16個の点数のばらつきを「タイプ向けコピーを一貫して高く評価した分（性格）」「タイプとは関係なく一貫した好み（自分の好み）」「場面によって変わった分（状況）」に分けたものです。1人分の回答から出したお楽しみの結果で、卒業論文では回答者全体の傾向を分析します。'),
      h('p', { class: 'muted small' }, '回答は1人1回でお願いします。全体の結果は、集計後に公開する予定です。')),
  );
  window.scrollTo(0, 0);

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
