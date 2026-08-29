'use client';

import { useMemo, useState, type ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * 类型定义 —— 对应 lib/course-data.ts 的 CourseCard 结构
 * ------------------------------------------------------------------------- */
type WordBankItem = {
  english: string;
  chinese: string;
  paragraph_form?: string;
  image_semantics?: string;
  word_bank_rationale?: string;
  image_file?: string;
  image?: string;
  illustration?: string;
};

type ComprehensionQuestion = {
  type: string;
  prompt: string;
  options: { A: string; B: string; C: string };
  answer: string;
};

type MatchPair = { word: string; meaning: string };

type ContextQuestion = {
  prompt: string;
  options: string[];
  answer: string;
  image_file?: string;
  image?: string;
};

type ListenSentence = { sentence: string; role: string };

type CardForm = {
  cardId: string;
  courseId: string;
  seriesId: string;
  topic: string;
  theme: string;
  day: string;
  level: string;
  title: string;
  bigQuestion: string;
  articleStructure: string;
  status: string;
  image_file: string;
  paragraphs: string[];
  translations: string[];
  word_bank: WordBankItem[];
  comprehension: { questions: ComprehensionQuestion[] };
  wordModule: {
    matchPairs: MatchPair[];
    contextQuestions: ContextQuestion[];
  };
  rebuild: { type: string; steps: string[] };
  listenRead: { sentences: ListenSentence[] };
};

const VALID_STRUCTURES = ['Feature-Function', 'Cause-Effect', 'Process/Life cycle', 'Compare-Contrast', 'Fact/Explanation'];
const VALID_LEVELS = ['L1', 'L2', 'L3'];
const QUESTION_TYPES = ['Whole', 'Connection', 'Transfer'];

const emptyCard = (): CardForm => ({
  cardId: '', courseId: 'science-reading', seriesId: 'science-reading', topic: 'Living Things', theme: '', day: '1',
  level: 'L1', title: '', bigQuestion: '', articleStructure: 'Process/Life cycle', status: 'draft', image_file: '',
  paragraphs: [''], translations: [''],
  word_bank: [],
  comprehension: { questions: [] },
  wordModule: { matchPairs: [], contextQuestions: [] },
  rebuild: { type: 'Process/Life cycle', steps: [] },
  listenRead: { sentences: [] },
});

/** 把上传/粘贴的 JSON 对象转换为可编辑表单结构（兼容不同字段写法）。 */
function fromJson(raw: unknown): CardForm | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const c = raw as Record<string, any>;

  const wordBank: WordBankItem[] = Array.isArray(c.word_bank)
    ? c.word_bank.map((w: any) => ({
        english: w.english ?? '',
        chinese: w.chinese ?? '',
        paragraph_form: w.paragraph_form ?? '',
        image_semantics: w.image_semantics ?? '',
        word_bank_rationale: w.word_bank_rationale ?? '',
        image_file: w.image_file ?? w.image ?? w.illustration ?? '',
      }))
    : [];

  const questions: ComprehensionQuestion[] = Array.isArray(c.comprehension?.questions)
    ? c.comprehension.questions.map((q: any) => ({
        type: q.type ?? 'Whole',
        prompt: q.prompt ?? '',
        options: { A: q.options?.A ?? '', B: q.options?.B ?? '', C: q.options?.C ?? '' },
        answer: q.answer ?? 'A',
      }))
    : [];

  const matchPairs: MatchPair[] = Array.isArray(c.wordModule?.matchPairs)
    ? c.wordModule.matchPairs.map((p: any) => ({ word: p.word ?? '', meaning: p.meaning ?? '' }))
    : [];

  const contextQuestions: ContextQuestion[] = Array.isArray(c.wordModule?.contextQuestions)
    ? c.wordModule.contextQuestions.map((q: any) => ({
        prompt: q.prompt ?? '',
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        answer: q.answer ?? '',
        image_file: q.image_file ?? q.image ?? '',
      }))
    : [];

  const rebuildSteps: string[] = Array.isArray(c.rebuild?.steps) ? c.rebuild.steps.map(String) : [];

  const sentences: ListenSentence[] = Array.isArray(c.listenRead?.sentences)
    ? c.listenRead.sentences.map((s: any) => ({ sentence: s.sentence ?? '', role: s.role ?? 'Science Core' }))
    : [];

  return {
    cardId: c.cardId ?? '',
    courseId: c.courseId ?? 'science-reading',
    seriesId: c.seriesId ?? c.courseId ?? 'science-reading',
    topic: c.topic ?? 'Living Things',
    theme: c.theme ?? '',
    day: String(c.day ?? 1),
    level: c.level ?? 'L1',
    title: c.title ?? '',
    bigQuestion: c.bigQuestion ?? '',
    articleStructure: c.articleStructure ?? c.structure ?? 'Process/Life cycle',
    status: c.status ?? 'draft',
    image_file: c.image_file ?? '',
    paragraphs: Array.isArray(c.paragraphs) ? c.paragraphs.map(String) : [''],
    translations: Array.isArray(c.translations) ? c.translations.map(String) : (Array.isArray(c.paragraphTranslations) ? c.paragraphTranslations.map(String) : ['']),
    word_bank: wordBank,
    comprehension: { questions },
    wordModule: { matchPairs, contextQuestions },
    rebuild: { type: c.rebuild?.type ?? c.articleStructure ?? 'Process/Life cycle', steps: rebuildSteps },
    listenRead: { sentences },
  };
}

/** 把表单状态序列化回课程 JSON。 */
function toJson(form: CardForm): Record<string, unknown> {
  return {
    version: '1.0',
    cardId: form.cardId,
    courseId: form.courseId,
    seriesId: form.seriesId,
    topic: form.topic,
    theme: form.theme,
    day: Number(form.day) || 1,
    level: form.level,
    title: form.title,
    bigQuestion: form.bigQuestion,
    image_file: form.image_file,
    articleStructure: form.articleStructure,
    structure: form.articleStructure,
    status: form.status,
    paragraphs: form.paragraphs.filter(p => p.trim()),
    translations: form.translations.filter(t => t.trim()).length === form.paragraphs.filter(p => p.trim()).length
      ? form.translations.filter(t => t.trim())
      : form.translations,
    word_bank: form.word_bank.map(w => ({
      english: w.english,
      chinese: w.chinese,
      paragraph_form: w.paragraph_form,
      image_semantics: w.image_semantics,
      word_bank_rationale: w.word_bank_rationale,
      ...(w.image_file ? { image_file: w.image_file } : {}),
    })),
    comprehension: {
      questions: form.comprehension.questions.map(q => ({
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
      })),
    },
    wordModule: {
      matchPairs: form.wordModule.matchPairs.map(p => ({ word: p.word, meaning: p.meaning })),
      contextQuestions: form.wordModule.contextQuestions.map(q => ({
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
        ...(q.image_file ? { image_file: q.image_file } : {}),
      })),
    },
    rebuild: { type: form.rebuild.type, steps: form.rebuild.steps.filter(s => s.trim()) },
    listenRead: { fullAudio: null, coreSentenceAudio: null, sentences: form.listenRead.sentences.filter(s => s.sentence.trim()) },
  };
}

/* ---------------------------------------------------------------------------
 * 小工具
 * ------------------------------------------------------------------------- */
function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; }) {
  return (
    <label className="imf-field">
      <span className="imf-label">{label}{hint && <em>{hint}</em>}</span>
      <input className="imf-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SectionTitle({ children, note }: { children: ReactNode; note?: string }) {
  return <div className="admin-section-head" style={{ marginTop: 8 }}>
    <h2>{children}</h2>
    {note && <span className="imf-note">{note}</span>}
  </div>;
}

/* ---------------------------------------------------------------------------
 * 主组件
 * ------------------------------------------------------------------------- */
export default function AdminImport() {
  const [jsonText, setJsonText] = useState('');
  const [form, setForm] = useState<CardForm | null>(null);
  const [images, setImages] = useState<Record<string, { url: string; file: File }>>({});
  const [result, setResult] = useState<{ ok: boolean; message: string; issues?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const imageNames = useMemo(() => Object.keys(images), [images]);

  /** 解析 JSON 文本 → 表单。 */
  const parseJson = (source: string): string[] => {
    if (!source.trim()) return ['请先粘贴或选择课程 JSON。'];
    let raw: unknown;
    try { raw = JSON.parse(source); } catch { return ['JSON 格式不正确，请检查引号、逗号与括号。']; }
    const parsed = fromJson(raw);
    if (!parsed) return ['JSON 顶层必须是对象（课程卡片）。'];
    setForm(parsed);
    setResult({ ok: true, message: `已解析卡片「${parsed.title || parsed.cardId || '未命名'}」，可在下方表单中编辑。` });
    return [];
  };

  /** 统一上传：JSON 文本 + JSON 文件 + 图片文件。 */
  const handleUpload = async () => {
    setBusy(true);
    setResult(null);
    const issues: string[] = [];

    // 1) 处理粘贴的 JSON 文本
    if (jsonText.trim()) {
      const errs = parseJson(jsonText);
      issues.push(...errs);
    }

    // 2) 收集所有需要提交的文件
    const formData = new FormData();
    let hasFile = false;

    for (const [name, entry] of Object.entries(images)) {
      formData.append('images', entry.file, name);
      hasFile = true;
    }
    // 未在文本区粘贴时，也把表单数据作为 JSON 提交（若有已解析卡片）
    if (!jsonText.trim() && form && form.cardId) {
      formData.append('json', new Blob([JSON.stringify(toJson(form), null, 2)], { type: 'application/json' }), `${form.cardId}.web-card.json`);
      hasFile = true;
    }

    if (!hasFile && issues.length === 0) {
      setResult({ ok: false, message: '请先粘贴 JSON 或上传文件。' });
      setBusy(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setResult({ ok: false, message: data.error || '上传失败，请检查服务器日志。' });
      } else {
        const cardIssues = (data.cards ?? []).flatMap((c: { name: string; issues: string[] }) => c.issues.map((i: string) => `${c.name}: ${i}`));
        setResult({
          ok: cardIssues.length === 0 && issues.length === 0,
          message: data.summary || '上传完成。',
          issues: [...issues, ...cardIssues],
        });
      }
    } catch {
      setResult({ ok: false, message: '无法连接上传接口，请确认开发服务器运行中。' });
    } finally {
      setBusy(false);
    }
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    setImages(prev => {
      const next = { ...prev };
      for (const file of Array.from(files)) next[file.name] = { url: URL.createObjectURL(file), file };
      return next;
    });
  };

  const handleJsonFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      file.text().then(text => {
        const errs = parseJson(text);
        if (errs.length) setResult({ ok: false, message: errs[0] });
      });
    }
  };

  const clear = () => { setJsonText(''); setForm(null); setImages({}); setResult(null); };

  const up = (patch: Partial<CardForm>) => setForm(f => (f ? { ...f, ...patch } : f));
  const updateStep = (index: number, value: string) => {
    setForm(f => {
      if (!f) return f;
      const steps = [...f.rebuild.steps];
      steps[index] = value;
      return { ...f, rebuild: { ...f.rebuild, steps } };
    });
  };

  if (!form) {
    /* ---------------- 空状态：只显示统一上传板块 ---------------- */
    return (
      <>
        <div className="admin-header">
          <div>
            <h1>数据上传</h1>
            <p>JSON + 图片统一上传（支持单个 / 批量），解析后以表单展示全部字段，并自动生成 webp 缩略图</p>
          </div>
        </div>

        <UploadPanel
          jsonText={jsonText}
          setJsonText={setJsonText}
          addImages={addImages}
          handleJsonFiles={handleJsonFiles}
          images={images}
          imageNames={imageNames}
          onUpload={handleUpload}
          onClear={clear}
          busy={busy}
          parseJson={parseJson}
        />

        {result && (
          <div className="panel" style={{ padding: 20 }}>
            <div className={`alert ${result.ok ? 'ok' : 'error'}`}>{result.ok ? '✓ ' : '✗ '}{result.message}</div>
            {result.issues && result.issues.length > 0 && (
              <ul className="admin-errors">
                {result.issues.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            )}
          </div>
        )}
      </>
    );
  }

  /* ---------------- 已解析：表单展示全部字段 ---------------- */
  const paragraphs = form.paragraphs.filter(p => p.trim());
  const translations = form.translations;

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>数据上传</h1>
          <p>JSON + 图片统一上传，下方表单展示全部字段，可继续编辑</p>
        </div>
        <div className="btn-row">
          <button className="btn" type="button" onClick={clear}>重新上传</button>
          <button className="btn primary" type="button" onClick={handleUpload} disabled={busy}>{busy ? '上传中…' : '保存 JSON + 图片'}</button>
        </div>
      </div>

      <UploadPanel
        jsonText={jsonText}
        setJsonText={setJsonText}
        addImages={addImages}
        handleJsonFiles={handleJsonFiles}
        images={images}
        imageNames={imageNames}
        onUpload={handleUpload}
        onClear={clear}
        busy={busy}
        parseJson={parseJson}
        compact
      />

      {result && (
        <div className="panel" style={{ padding: 20, marginBottom: 18 }}>
          <div className={`alert ${result.ok ? 'ok' : 'error'}`}>{result.ok ? '✓ ' : '✗ '}{result.message}</div>
          {result.issues && result.issues.length > 0 && (
            <ul className="admin-errors">{result.issues.map((err, i) => <li key={i}>{err}</li>)}</ul>
          )}
        </div>
      )}

      <div className="panel" style={{ padding: 20 }}>
        {/* 1. 卡片信息 */}
        <SectionTitle note="index 卡片列表与详情页展示">卡片信息</SectionTitle>
        <div className="imf-grid">
          <Field label="Card ID" value={form.cardId} onChange={v => up({ cardId: v })} placeholder="day011-seed" />
          <Field label="标题 title" value={form.title} onChange={v => up({ title: v })} placeholder="SEED" />
          <Field label="课程 courseId" value={form.courseId} onChange={v => up({ courseId: v })} />
          <Field label="系列 seriesId" value={form.seriesId} onChange={v => up({ seriesId: v })} />
          <label className="imf-field">
            <span className="imf-label">主题 topic</span>
            <input className="imf-input" value={form.topic} onChange={e => up({ topic: e.target.value })} />
          </label>
          <label className="imf-field">
            <span className="imf-label">子主题 theme</span>
            <input className="imf-input" value={form.theme} onChange={e => up({ theme: e.target.value })} />
          </label>
          <label className="imf-field">
            <span className="imf-label">Day</span>
            <input className="imf-input" type="number" min={1} value={form.day} onChange={e => up({ day: e.target.value })} />
          </label>
          <label className="imf-field">
            <span className="imf-label">等级 level</span>
            <select className="imf-input" value={form.level} onChange={e => up({ level: e.target.value })}>
              {VALID_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <Field label="大问题 bigQuestion" value={form.bigQuestion} onChange={v => up({ bigQuestion: v })} placeholder="How does a seed grow?" />
          <label className="imf-field">
            <span className="imf-label">文章结构 articleStructure</span>
            <select className="imf-input" value={form.articleStructure} onChange={e => { up({ articleStructure: e.target.value }); up({ rebuild: { ...form.rebuild, type: e.target.value } }); }}>
              {VALID_STRUCTURES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="imf-field">
            <span className="imf-label">状态 status</span>
            <select className="imf-input" value={form.status} onChange={e => up({ status: e.target.value })}>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </label>
          <Field label="主图文件名 image_file" value={form.image_file} onChange={v => up({ image_file: v })} hint="上传图片后自动对应" />
        </div>

        {/* 2. 正文 + 中文翻译 */}
        <SectionTitle note="reading 模块逐句翻译">正文与中文翻译</SectionTitle>
        <div className="imf-paragraphs">
          {paragraphs.map((p, i) => (
            <div className="imf-para" key={i}>
              <div className="imf-para-head"><b>英文段落 {i + 1}</b></div>
              <textarea className="imf-textarea" rows={3} value={p} onChange={e => { const next = [...form.paragraphs]; next[i] = e.target.value; up({ paragraphs: next }); }} />
              <div className="imf-para-head" style={{ marginTop: 8 }}><b>中文翻译 {i + 1}</b></div>
              <textarea className="imf-textarea" rows={2} value={translations[i] ?? ''} onChange={e => { const next = [...form.translations]; next[i] = e.target.value; up({ translations: next }); }} placeholder="该段的中文翻译" />
            </div>
          ))}
        </div>

        {/* 3. 核心词 word_bank */}
        <SectionTitle note="words 模块词卡 + 配图">核心词（word_bank）</SectionTitle>
        <div className="imf-words">
          {form.word_bank.map((w, i) => (
            <div className="imf-word" key={i}>
              <div className="imf-word-head"><b>核心词 #{i + 1}</b></div>
              <div className="imf-grid">
                <Field label="英文 english" value={w.english} onChange={v => { const next = [...form.word_bank]; next[i] = { ...w, english: v }; up({ word_bank: next }); }} />
                <Field label="中文 chinese" value={w.chinese} onChange={v => { const next = [...form.word_bank]; next[i] = { ...w, chinese: v }; up({ word_bank: next }); }} />
                <Field label="段落形式 paragraph_form" value={w.paragraph_form ?? ''} onChange={v => { const next = [...form.word_bank]; next[i] = { ...w, paragraph_form: v }; up({ word_bank: next }); }} />
                <Field label="配图文件名 image_file" value={w.image_file ?? ''} onChange={v => { const next = [...form.word_bank]; next[i] = { ...w, image_file: v }; up({ word_bank: next }); }} hint="选填" />
              </div>
              <Field label="配图语义 image_semantics" value={w.image_semantics ?? ''} onChange={v => { const next = [...form.word_bank]; next[i] = { ...w, image_semantics: v }; up({ word_bank: next }); }} />
              <Field label="收录理由 word_bank_rationale" value={w.word_bank_rationale ?? ''} onChange={v => { const next = [...form.word_bank]; next[i] = { ...w, word_bank_rationale: v }; up({ word_bank: next }); }} />
            </div>
          ))}
        </div>

        {/* 4. 阅读理解 3Q */}
        <SectionTitle note="comprehension 恰好 3 题">阅读理解（3Q）</SectionTitle>
        <div className="imf-words">
          {form.comprehension.questions.map((q, i) => (
            <div className="imf-word" key={i}>
              <div className="imf-word-head"><b>第 {i + 1} 题</b></div>
              <div className="imf-grid">
                <label className="imf-field">
                  <span className="imf-label">类型 type</span>
                  <select className="imf-input" value={q.type} onChange={e => { const next = [...form.comprehension.questions]; next[i] = { ...q, type: e.target.value }; up({ comprehension: { questions: next } }); }}>
                    {QUESTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="imf-field">
                  <span className="imf-label">正确答案</span>
                  <select className="imf-input" value={q.answer} onChange={e => { const next = [...form.comprehension.questions]; next[i] = { ...q, answer: e.target.value }; up({ comprehension: { questions: next } }); }}>
                    {(['A', 'B', 'C'] as const).map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
              </div>
              <Field label="问题 prompt" value={q.prompt} onChange={v => { const next = [...form.comprehension.questions]; next[i] = { ...q, prompt: v }; up({ comprehension: { questions: next } }); }} />
              {(['A', 'B', 'C'] as const).map(key => (
                <Field key={key} label={`选项 ${key}`} value={q.options[key]} onChange={v => { const next = [...form.comprehension.questions]; next[i] = { ...q, options: { ...q.options, [key]: v } }; up({ comprehension: { questions: next } }); }} />
              ))}
            </div>
          ))}
        </div>

        {/* 5. 词义配对 */}
        <SectionTitle note="words 板块 Meaning Match">词义配对（matchPairs）</SectionTitle>
        <div className="imf-grid imf-pairs">
          {form.wordModule.matchPairs.map((p, i) => (
            <div className="imf-pair" key={i}>
              <input className="imf-input" value={p.word} onChange={e => { const next = [...form.wordModule.matchPairs]; next[i] = { ...p, word: e.target.value }; up({ wordModule: { ...form.wordModule, matchPairs: next } }); }} placeholder="单词" />
              <span className="imf-arrow">→</span>
              <input className="imf-input" value={p.meaning} onChange={e => { const next = [...form.wordModule.matchPairs]; next[i] = { ...p, meaning: e.target.value }; up({ wordModule: { ...form.wordModule, matchPairs: next } }); }} placeholder="含义" />
            </div>
          ))}
          {form.wordModule.matchPairs.length === 0 && <p className="muted">暂无配对。</p>}
        </div>

        {/* 6. FILL THE GAP 填空（含配图） */}
        <SectionTitle note="words 板块 Fill the Gap，可选句子配图">填空挑战（contextQuestions）</SectionTitle>
        <div className="imf-words">
          {form.wordModule.contextQuestions.map((q, i) => (
            <div className="imf-word" key={i}>
              <div className="imf-word-head"><b>填空 #{i + 1}</b></div>
              <Field label="句子 prompt（用 __ 表示空位）" value={q.prompt} onChange={v => { const next = [...form.wordModule.contextQuestions]; next[i] = { ...q, prompt: v }; up({ wordModule: { ...form.wordModule, contextQuestions: next } }); }} />
              <div className="imf-grid">
                <Field label="正确答案 answer" value={q.answer} onChange={v => { const next = [...form.wordModule.contextQuestions]; next[i] = { ...q, answer: v }; up({ wordModule: { ...form.wordModule, contextQuestions: next } }); }} />
                <Field label="配图文件名 image_file" value={q.image_file ?? ''} onChange={v => { const next = [...form.wordModule.contextQuestions]; next[i] = { ...q, image_file: v }; up({ wordModule: { ...form.wordModule, contextQuestions: next } }); }} hint="选填" />
              </div>
              <label className="imf-field">
                <span className="imf-label">干扰项 options</span>
                <input className="imf-input" value={q.options.join('、')} onChange={e => { const next = [...form.wordModule.contextQuestions]; next[i] = { ...q, options: e.target.value.split(/[、,，]/).map(s => s.trim()).filter(Boolean) }; up({ wordModule: { ...form.wordModule, contextQuestions: next } }); }} placeholder="用顿号分隔" />
              </label>
            </div>
          ))}
          {form.wordModule.contextQuestions.length === 0 && <p className="muted">暂无填空句。</p>}
        </div>

        {/* 7. 结构重建 */}
        <SectionTitle note="rebuild 模块步骤或配对">结构重建（rebuild）</SectionTitle>
        <div className="imf-grid imf-pairs">
          <label className="imf-field">
            <span className="imf-label">结构类型 type</span>
            <select className="imf-input" value={form.rebuild.type} onChange={e => up({ rebuild: { ...form.rebuild, type: e.target.value } })}>
              {VALID_STRUCTURES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <div className="imf-paragraphs">
          {form.rebuild.steps.map((s, i) => (
            <div className="imf-para" key={i}>
              <div className="imf-para-head"><b>步骤 {i + 1}</b></div>
              <input className="imf-input" value={s} onChange={e => updateStep(i, e.target.value)} />
            </div>
          ))}
        </div>

        {/* 8. 听读句子 */}
        <SectionTitle note="listenRead 听读模块句子">听读句子</SectionTitle>
        <div className="imf-paragraphs">
          {form.listenRead.sentences.map((s, i) => (
            <div className="imf-para" key={i}>
              <div className="imf-para-head"><b>句子 {i + 1}</b></div>
              <input className="imf-input" value={s.sentence} onChange={e => { const next = [...form.listenRead.sentences]; next[i] = { ...s, sentence: e.target.value }; up({ listenRead: { ...form.listenRead, sentences: next } }); }} />
              <div className="imf-para-head" style={{ marginTop: 8 }}><b>角色 role</b></div>
              <input className="imf-input" value={s.role} onChange={e => { const next = [...form.listenRead.sentences]; next[i] = { ...s, role: e.target.value }; up({ listenRead: { ...form.listenRead, sentences: next } }); }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * 统一上传板块（JSON + 图片，支持单个 / 批量）
 * ------------------------------------------------------------------------- */
function UploadPanel(props: {
  jsonText: string;
  setJsonText: (v: string) => void;
  addImages: (files: FileList | null) => void;
  handleJsonFiles: (files: FileList | null) => void;
  images: Record<string, { url: string; file: File }>;
  imageNames: string[];
  onUpload: () => void;
  onClear: () => void;
  busy: boolean;
  parseJson: (source: string) => string[];
  compact?: boolean;
}) {
  const { jsonText, setJsonText, addImages, handleJsonFiles, images, imageNames, onUpload, onClear, busy, parseJson, compact } = props;
  return (
    <section className={`panel ${compact ? 'imf-upload-compact' : ''}`} style={{ padding: 20, marginBottom: 18 }}>
      <div className="admin-section-head"><h2>JSON + 图片上传</h2><span className="imf-note">可单个或批量（一次选多个文件）；上传后自动生成 webp 缩略图</span></div>

      <div className="imf-upload-layout">
        {/* 左：JSON */}
        <div className="imf-upload-col">
          <div className="imf-col-head"><b>① JSON 内容</b></div>
          <textarea
            className="admin-code-area imf-json-area"
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            placeholder='粘贴课程 JSON，或从下方选择 .json 文件（可多选）&#10;{ "cardId": "day011-seed", "title": "…" }'
            spellCheck={false}
          />
          <div className="btn-row" style={{ marginTop: 10 }}>
            <label className="btn" style={{ cursor: 'pointer' }}>
              选择 JSON 文件（批量）
              <input type="file" accept=".json,application/json" multiple hidden onChange={e => { handleJsonFiles(e.target.files); e.target.value = ''; }} />
            </label>
            <button className="btn" type="button" onClick={() => parseJson(jsonText)}>解析到表单</button>
          </div>
        </div>

        {/* 右：图片 */}
        <div className="imf-upload-col">
          <div className="imf-col-head"><b>② 图片文件（支持 PNG / JPG / WEBP，可批量）</b></div>
          <label className="imf-dropzone">
            <input type="file" accept=".png,.jpg,.jpeg,.webp,image/*" multiple hidden onChange={e => { addImages(e.target.files); e.target.value = ''; }} />
            <span className="imf-dropzone-main">点击或拖入图片</span>
            <span className="imf-dropzone-sub">主图 / 核心词配图 / 填空句配图均可，按文件名与 JSON 中的 image_file 对应</span>
          </label>
          {imageNames.length > 0 && (
            <div className="imf-thumbs">
              {imageNames.map(name => (
                <figure className="imf-thumb" key={name}>
                  <img src={images[name].url} alt={name} />
                  <figcaption title={name}>{name}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
        <button className="btn primary" type="button" onClick={onUpload} disabled={busy}>{busy ? '处理中…' : '上传并生成 webp 缩略图'}</button>
        <button className="btn" type="button" onClick={onClear}>清空</button>
      </div>
    </section>
  );
}