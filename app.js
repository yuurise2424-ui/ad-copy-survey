'use strict';

/*
 * 卒論アンケートサイト（ワイヤレスイヤホン1商品版、2026-11-24）
 * 内容は create_form.gs（2026-11-15版）に合わせている。
 * 違い: 場面順のA/Bは生まれ月ではなくランダムに割り当てる。最後に結果と答え合わせを出す。
 * 回答は Supabase の responses テーブルに送る（書き込み専用。ブラウザからは読めない）。
 */

const SUPABASE_URL = 'https://ljsotmcpaqdlvmysvnsj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fN0wj547S7tuJyVvwKlcEg_3s1q4kyf';
const VERSION = 'web-1';

const UNIVERSITY = '名城大学';
const AUTHOR = '西垣優';
const CONTACT = 'yuurise2424@gmail.com';
const TEST_URL = 'https://www.16personalities.com/ja/%E6%80%A7%E6%A0%BC%E8%A8%BA%E6%96%AD%E3%83%86%E3%82%B9%E3%83%88';

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

function paragraphs(text) {
  return text.split('\n').map((line) => h('p', null, line));
}

function choiceGroup(name, legend, options, value, onChange) {
  return h('fieldset', null,
    h('legend', null, legend),
    h('div', { class: 'choices' },
      options.map(([val, label]) => h('label', { class: 'choice' },
        h('input', { type: 'radio', name, value: val, checked: value === val,
          onchange: () => onChange(val) }),
        label))));
}

function scaleRow(name, legend, value, onChange, lowLabel, highLabel, legendClass) {
  return h('fieldset', null,
    h('legend', { class: legendClass }, legend),
    h('div', { class: 'scale' },
      [1, 2, 3, 4, 5, 6, 7].map((n) => h('label', null,
        h('input', { type: 'radio', name, value: String(n), checked: value === n,
          'aria-label': legend + ' ' + n, onchange: () => onChange(n) }),
        h('span', null, String(n))))),
    h('div', { class: 'scale-ends' }, h('span', null, '1：' + lowLabel), h('span', null, '7：' + highLabel)));
}

function rotate(items, offset) {
  return items.slice(offset).concat(items.slice(0, offset));
}

// ---------- pages ----------

const pages = {
  consent: () => ({
    body: [
      h('h1', null, 'MBTI診断（16Personalities）と購買に関するアンケート'),
      h('p', null, 'このアンケートは、' + UNIVERSITY + 'の卒業論文のための調査です。16Personalitiesの診断結果と、買い物や広告の感じ方について聞きます。対象は18歳以上の方です。'),
      h('p', null, '最後まで答えると、あなたが広告を見て「性格どおりに」反応したのか、「状況に左右されて」反応したのかが分かる結果が表示されます。'),
      h('p', null, '16Personalitiesは、一般に「MBTI診断」と呼ばれることの多い無料の性格診断です（建築家、仲介者などのタイプが出るものです）。正式なMBTIとは別のものです。'),
      h('p', null, '所要時間は約5分です（16Personalitiesの診断を今から受ける場合は約15分）。回答は匿名で、氏名やメールアドレスは集めません。結果は統計的に処理し、卒業論文にのみ使用します。'),
      h('p', null, '回答は任意で、途中でやめても不利益はありません。送信後は匿名のため、個別の削除ができません。'),
      h('p', { class: 'muted' }, '問い合わせ先：' + AUTHOR + '（' + CONTACT + '）'),
    ],
    nextLabel: '同意して始める',
    extraButton: h('button', { type: 'button', onclick: () => showEnd('同意いただけない場合は、このページを閉じてください。ご覧いただきありがとうございました。') }, '同意しない'),
    validate: () => { state.a.consent = true; return null; },
  }),

  experience: () => ({
    body: [
      h('h2', null, '16Personalitiesの受検経験'),
      choiceGroup('experience', '16Personalities（いわゆるMBTI診断）を受けたことがありますか。',
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
      h('h2', null, '受検の案内'),
      h('p', null, '別のタブで次のページを開き、診断を受けてください。結果のページは開いたままにして、このページに戻ってください。'),
      h('p', null, h('a', { href: TEST_URL, target: '_blank', rel: 'noopener noreferrer' }, '16Personalities 無料性格診断テスト（別タブで開きます）')),
      h('p', { class: 'muted' }, 'このページは閉じずにそのままにしておいてください。'),
    ],
    nextLabel: '診断を受けた',
    validate: () => null,
  }),

  profile: () => ({
    body: [
      h('h2', null, 'あなたについて'),
      PROFILE.map(([key, label, options]) =>
        choiceGroup(key, label, options.map((o) => [o, o]), state.a[key], (v) => { state.a[key] = v; })),
    ],
    validate: () => (PROFILE.every(([key]) => state.a[key]) ? null : 'すべての質問に答えてください。'),
  }),

  adIntro: () => ({
    body: [
      h('h2', null, 'これからの質問について'),
      h('p', null, 'これから、ワイヤレスイヤホンについてお聞きします。'),
      h('p', null, '4つの場面を想像していただき、場面ごとでの広告コピーについての印象をお答えください。どの場面でも、買うつもりで来ていて、お金は十分にあることを前提にお答えください。'),
      h('p', null, '4つのコピーは、すべて同じ1つのイヤホン（下の画像）に付いているものです。'),
      h('img', { class: 'product-img', src: 'earphone.svg', alt: 'ワイヤレスイヤホンと充電ケースのイラスト' }),
      h('p', null, '各ページでは、まず【今回の状況】を読んでから、コピーへの回答を選んでください。'),
    ],
    validate: () => null,
  }),

  interest: () => ({
    body: [
      h('h2', null, '商品への関心'),
      scaleRow('interest', 'ふだん、ワイヤレスイヤホンにどれくらい関心がありますか', state.a.interest,
        (n) => { state.a.interest = n; }, '全くない', 'とてもある'),
    ],
    validate: () => (state.a.interest ? null : '選択してください。'),
  }),

  mbti: () => {
    const typeSelect = h('select', { id: 'type', onchange: (e) => { state.a.type = e.target.value; } },
      h('option', { value: '' }, '選択してください'),
      TYPES.map(([code, name]) => h('option', { value: code, selected: state.a.type === code }, code + '（' + name + '）')),
      h('option', { value: 'unknown', selected: state.a.type === 'unknown' }, '覚えていない'));
    return {
      body: [
        h('h2', null, '16Personalitiesの結果'),
        h('p', null, '診断の結果について教えてください。'),
        h('fieldset', null, h('legend', null, h('label', { for: 'type' }, '診断タイプ')), typeSelect),
        choiceGroup('identity', 'タイプ末尾の文字', [['A', '-A'], ['T', '-T'], ['unknown', '覚えていない']],
          state.a.identity, (v) => { state.a.identity = v; }),
        h('p', { class: 'muted' }, '次の5つは、結果ページを見られる人だけ、自分の側に表示された数字（50〜100）を入力してください。分からなければ空欄で構いません。'),
        AXES.map(([key, label]) => h('fieldset', null,
          h('legend', null, h('label', { for: 'axis-' + key }, label + 'の%')),
          h('input', { id: 'axis-' + key, type: 'number', inputmode: 'numeric', min: '50', max: '100', step: '1',
            value: state.a.axes[key] ?? '', oninput: (e) => {
              const v = e.target.value === '' ? undefined : Number(e.target.value);
              state.a.axes[key] = v;
            } }))),
        choiceGroup('lastTaken', '最後に受けた時期', ['今日', '3か月以内', '1年以内', '1年以上前', '覚えていない'].map((o) => [o, o]),
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
    };
  },

  belief: () => {
    const rows = BELIEF.slice();
    rows.splice(2, 0, ['check2', '確認のため、この行は「3」を選んでください']);
    return {
      body: [
        h('h2', null, '診断についての考え'),
        h('p', null, '次の文はどれくらい当てはまりますか。'),
        rows.map(([key, label]) => scaleRow('belief-' + key, label, state.a.belief[key],
          (n) => { state.a.belief[key] = n; }, '全く当てはまらない', 'とても当てはまる')),
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
      h('h2', null, 'ワイヤレスイヤホン（場面 ' + (index + 1) + ' / 4：' + scene.label + '）'),
      h('p', null, index === 0 ? INTRO : LEAD_NEXT),
      h('img', { class: 'product-img', src: 'earphone.svg', alt: 'ワイヤレスイヤホンと充電ケースのイラスト' }),
      h('div', { class: 'caption' }, '4つのコピーは、すべてこの同じイヤホンのものです'),
      h('div', { class: 'situation' }, h('strong', null, '【今回の状況】'), scene.text),
      h('p', null, h('b', null, 'このコピーが書かれていたら、このイヤホンを買いたいと思いますか。')),
      rows.map((r) => scaleRow('r-' + sceneKey + '-' + r.id, r.id === 'CHECK' ? r.text : '「' + r.text + '」',
        ratings[r.id], (n) => { ratings[r.id] = n; }, '全く買いたくない', 'とても買いたい', 'copy-legend')),
    ],
    validate: () => (rows.every((r) => ratings[r.id]) ? null : 'すべてのコピーに答えてください。'),
  };
}

// ---------- rendering ----------

const app = document.getElementById('app');
const bar = document.getElementById('bar');

function render() {
  const list = steps();
  const key = list[state.step];
  const page = key.startsWith('scene') ? scenePage(Number(key.slice(5))) : pages[key]();
  bar.style.width = Math.round((state.step / list.length) * 100) + '%';

  const error = h('p', { class: 'error', role: 'alert' });
  const next = h('button', { type: 'button', class: 'primary', onclick: () => {
    const msg = page.validate();
    if (msg === 'stop') return;
    if (msg) { error.textContent = msg; return; }
    recordTiming(key);
    if (state.step === list.length - 1) { submit(); return; }
    state.step += 1;
    render();
  } }, page.nextLabel || '次へ');
  const back = state.step > 0
    ? h('button', { type: 'button', onclick: () => { recordTiming(key); state.step -= 1; render(); } }, '戻る')
    : null;

  app.replaceChildren(h('section', { class: 'card' }, page.body, error,
    h('div', { class: 'nav' }, back, page.extraButton, next)));
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
  app.replaceChildren(h('section', { class: 'card' }, h('h2', null, 'ありがとうございました'), h('p', null, message)));
}

// ---------- submit ----------

async function submit() {
  const btn = app.querySelector('button.primary');
  const error = app.querySelector('.error');
  btn.disabled = true;
  btn.textContent = '送信中…';
  error.textContent = '';

  const answers = Object.assign({}, state.a, {
    order: state.order,
    check1: state.a.ratings[ORDERS[state.order][1]].CHECK,
    timings: state.timings,
    startedAt: state.startedAt,
    submittedAt: new Date().toISOString(),
    mobile: window.matchMedia('(pointer: coarse)').matches,
  });

  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/responses', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ version: VERSION, answers }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.submitted = true;
    showResult();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'もう一度送信する';
    error.textContent = '送信できませんでした。通信環境を確認して、もう一度押してください。';
  }
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

function showResult() {
  bar.style.width = '100%';
  const res = computeResult();
  const typeName = TYPES.find(([c]) => c === state.a.type);
  const mine = res.myCopy ? COPIES.find((c) => c.id === res.myCopy) : null;

  const split = h('div', { class: 'split', role: 'img',
    'aria-label': '性格' + res.person + '%、好み' + res.pref + '%、状況' + res.situ + '%' });
  [['seg-person', res.person], ['seg-pref', res.pref], ['seg-situ', res.situ]].forEach(([cls, v]) => {
    const seg = h('div', { class: cls });
    seg.style.width = v + '%';
    split.append(seg);
  });

  const maxMean = 7;
  const copyBars = COPIES.map((c, i) => {
    const fill = h('div', { class: 'fill' });
    fill.style.width = Math.round((res.copyMeans[i] / maxMean) * 100) + '%';
    return h('div', { class: 'barrow' + (c.id === res.myCopy ? ' mine' : '') },
      h('div', { class: 'lbl' }, (c.id === res.myCopy ? '★ ' : '') + '「' + c.text + '」 平均 ' + res.copyMeans[i].toFixed(1)),
      h('div', { class: 'track' }, fill));
  });

  const sceneSorted = res.sceneKeys.map((s, j) => [s, res.sceneMeans[j]]).sort((a, b) => b[1] - a[1]);
  const hi = sceneSorted[0];
  const lo = sceneSorted[sceneSorted.length - 1];

  app.replaceChildren(
    h('section', { class: 'card' },
      h('p', { class: 'muted' }, 'ご回答ありがとうございました。あなたの結果です'),
      h('div', { class: 'result-type' }, resultTitle(res)),
      typeName ? h('p', null, 'あなたのタイプ：' + typeName[0] + '（' + typeName[1] + '）') : null,
      h('div', { class: 'big-pct' },
        h('div', null, h('b', null, res.person + '%'), '性格'),
        h('div', null, h('b', null, res.situ + '%'), '状況')),
      split,
      h('div', { class: 'legend' },
        h('span', null, h('i', { class: 'seg-person' }), '性格どおり ' + res.person + '%'),
        h('span', null, h('i', { class: 'seg-pref' }), '自分の好み ' + res.pref + '%'),
        h('span', null, h('i', { class: 'seg-situ' }), '状況しだい ' + res.situ + '%')),
      h('p', null, resultComment(res)),
      !mine ? h('p', { class: 'muted' }, 'タイプが分からなかったため、性格どおりかどうかは判定していません。') : null),

    h('section', { class: 'card' },
      h('h2', null, 'コピーごとの「買いたい」平均'),
      mine ? h('p', { class: 'muted' }, '★が、あなたのタイプ（' + res.myCopy + '）に刺さる想定で作ったコピーです。') : null,
      h('div', { class: 'bars' }, copyBars),
      res.total > 1e-9 ? h('p', { class: 'muted' },
        'いちばん買いたくなった場面は「' + SCENES[hi[0]].label + '」（平均 ' + hi[1].toFixed(1) + '）、' +
        'いちばん買いたくなくなった場面は「' + SCENES[lo[0]].label + '」（平均 ' + lo[1].toFixed(1) + '）でした。') : null),

    h('section', { class: 'card' },
      h('h2', null, '答え合わせ：実はこう作っていました'),
      h('p', null, '4つのコピーは、16Personalitiesの「感覚型(S)・直観型(N)」と「思考型(T)・感情型(F)」の組み合わせごとに、そのタイプの人に刺さるという想定で作りました。'),
      COPIES.map((c) => h('div', { class: 'reveal' + (c.id === res.myCopy ? ' mine' : '') },
        h('h3', null, h('span', { class: 'tag' }, c.id), '「' + c.text + '」'),
        h('p', { class: 'muted' }, c.target + ' 向け' + (c.id === res.myCopy ? '（あなたのタイプ）' : '')),
        h('p', null, c.why)))),

    h('section', { class: 'card' },
      h('h3', null, 'この結果について'),
      h('p', { class: 'muted' }, 'この割合は、あなたが付けた16個の点数のばらつきを「タイプ向けコピーを一貫して高く評価した分（性格）」「タイプとは関係なく一貫した好み（自分の好み）」「場面によって変わった分（状況）」に分けたものです。1人分の回答から出したお楽しみの結果で、卒業論文では回答者全体の傾向を分析します。'),
      h('p', { class: 'muted' }, '回答は1人1回でお願いします。全体の結果は、集計後に公開する予定です。')),
  );
  window.scrollTo(0, 0);
}

window.addEventListener('beforeunload', (e) => {
  if (state.step > 0 && !state.submitted) { e.preventDefault(); e.returnValue = ''; }
});

render();
