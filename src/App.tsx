import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Award,
  BadgeCheck,
  Bookmark,
  BookOpen,
  Camera,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock3,
  Heart,
  House,
  Landmark,
  LayoutGrid,
  Leaf,
  MessageCircle,
  NotebookTabs,
  PackageOpen,
  PenLine,
  Plus,
  Scissors,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  UserRound,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'
import './App.css'
import { fallbackCraftData } from './data/craftData'
import { fetchCraftCloudData, reviewCraftContent } from './lib/api'
import type {
  AiReviewResult,
  CloudData,
  CraftCategory,
  CraftKind,
  PageKey,
  PublishedWork,
  QuestionItem,
  Tutorial,
} from './types'

type BeforeInstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PublishForm {
  title: string
  categoryId: string
  materials: string
  steps: string
  note: string
  imageData?: string
}

const navItems: Array<{ key: PageKey; label: string; icon: LucideIcon }> = [
  { key: 'home', label: '首页', icon: House },
  { key: 'category', label: '分类', icon: LayoutGrid },
  { key: 'chinaCraft', label: '国风', icon: Landmark },
  { key: 'publish', label: '发布', icon: PenLine },
  { key: 'qa', label: '问答', icon: MessageCircle },
  { key: 'mine', label: '工坊', icon: UserRound },
]

const baseUrl = import.meta.env.BASE_URL

const initialForm: PublishForm = {
  title: '',
  categoryId: 'paper-cut',
  materials: '',
  steps: '',
  note: '',
}

function App() {
  const [activePage, setActivePage] = useState<PageKey>('home')
  const [cloudData, setCloudData] = useState<CloudData>(fallbackCraftData)
  const [cloudSource, setCloudSource] = useState<'cloud' | 'fallback'>('fallback')
  const [cloudUrl, setCloudUrl] = useState('')
  const [query, setQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [selectedTutorialId, setSelectedTutorialId] = useState(fallbackCraftData.tutorials[0]?.id ?? '')
  const [favoriteIds, setFavoriteIds] = useStoredState<string[]>('shijiang:favorites', [])
  const [likedIds, setLikedIds] = useStoredState<string[]>('shijiang:likes', [])
  const [publishedWorks, setPublishedWorks] = useStoredState<PublishedWork[]>('shijiang:published', [])
  const [localQuestions, setLocalQuestions] = useStoredState<QuestionItem[]>('shijiang:questions', [])
  const [form, setForm] = useStoredState<PublishForm>('shijiang:publishDraft', initialForm)
  const [review, setReview] = useState<AiReviewResult | null>(null)
  const [questionDraft, setQuestionDraft] = useState('')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPrompt | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let mounted = true
    fetchCraftCloudData().then((result) => {
      if (!mounted) return
      setCloudData(result.data)
      setCloudSource(result.source)
      setCloudUrl(result.url)
      setSelectedTutorialId((current) => current || result.data.tutorials[0]?.id || '')
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const categoriesById = useMemo(
    () => new Map(cloudData.categories.map((category) => [category.id, category])),
    [cloudData.categories],
  )

  const allTutorials = useMemo(() => {
    const publishedTutorials: Tutorial[] = publishedWorks.map((work) => ({
      id: work.id,
      title: work.title,
      categoryId: work.categoryId,
      kind: work.kind,
      difficulty: 1,
      likes: 0,
      saves: 0,
      author: '我',
      duration: '刚刚发布',
      image: work.imageData || 'assets/crafts/user-work.png',
      summary: work.note || work.steps.slice(0, 60) || '我发布的新手工作品',
      materials: work.materials.split(/[，,\n]/).filter(Boolean),
      steps: work.steps.split(/\n/).filter(Boolean),
      tags: ['我的作品', categoriesById.get(work.categoryId)?.name ?? '手工'],
      heritageNote: work.kind === '传统国风非遗' ? work.note : undefined,
    }))
    return [...publishedTutorials, ...cloudData.tutorials]
  }, [categoriesById, cloudData.tutorials, publishedWorks])

  const featuredTutorials = useMemo(
    () => allTutorials.filter((tutorial) => tutorial.featured || tutorial.kind === '传统国风非遗').slice(0, 6),
    [allTutorials],
  )

  const filteredTutorials = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return allTutorials.filter((tutorial) => {
      const category = categoriesById.get(tutorial.categoryId)
      const matchesCategory =
        selectedCategoryId === 'all' ||
        tutorial.categoryId === selectedCategoryId ||
        (selectedCategoryId === 'traditional' && tutorial.kind === '传统国风非遗') ||
        (selectedCategoryId === 'general' && tutorial.kind === '通用手工')
      const searchable = [
        tutorial.title,
        tutorial.summary,
        tutorial.kind,
        category?.name,
        ...tutorial.tags,
        ...tutorial.materials,
      ]
        .join(' ')
        .toLowerCase()
      return matchesCategory && (!normalized || searchable.includes(normalized))
    })
  }, [allTutorials, categoriesById, query, selectedCategoryId])

  const selectedTutorial =
    allTutorials.find((tutorial) => tutorial.id === selectedTutorialId) ?? allTutorials[0]

  const questions = useMemo(
    () => [...localQuestions, ...cloudData.questions],
    [cloudData.questions, localQuestions],
  )

  const currentCategory = categoriesById.get(form.categoryId) ?? cloudData.categories[0]
  const currentKind: CraftKind = currentCategory?.kind ?? '传统国风非遗'
  const traditionalCount = allTutorials.filter((tutorial) => tutorial.kind === '传统国风非遗').length
  const likedSet = new Set(likedIds)
  const favoriteSet = new Set(favoriteIds)

  const showToast = (message: string) => setToast(message)

  const switchPage = (page: PageKey) => {
    setActivePage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const applyCategory = (categoryId: string, page: PageKey = 'category') => {
    setSelectedCategoryId(categoryId)
    switchPage(page)
  }

  const toggleFavorite = (tutorialId: string) => {
    setFavoriteIds((current) =>
      current.includes(tutorialId) ? current.filter((id) => id !== tutorialId) : [tutorialId, ...current],
    )
  }

  const toggleLike = (tutorialId: string) => {
    setLikedIds((current) =>
      current.includes(tutorialId) ? current.filter((id) => id !== tutorialId) : [tutorialId, ...current],
    )
  }

  const runReview = () => {
    const combinedText = `${form.title} ${currentCategory?.name ?? ''} ${form.materials} ${form.steps} ${form.note}`
    const nextReview = reviewCraftContent(combinedText, cloudData.allowedKeywords, cloudData.blockedKeywords)
    setReview(nextReview)
  }

  const publishWork = () => {
    if (!review?.passed || !form.title.trim()) {
      showToast('请先通过AI预审')
      return
    }

    const nextWork: PublishedWork = {
      id: `work-${Date.now()}`,
      title: form.title.trim(),
      categoryId: form.categoryId,
      kind: currentKind,
      materials: form.materials.trim(),
      steps: form.steps.trim(),
      note: form.note.trim(),
      imageData: form.imageData,
      aiScore: review.score,
      createdAt: new Date().toISOString(),
    }

    setPublishedWorks((current) => [nextWork, ...current])
    setForm(initialForm)
    setReview(null)
    showToast('作品已发布到我的工坊')
    switchPage('mine')
  }

  const submitQuestion = () => {
    if (!questionDraft.trim()) return
    const nextQuestion: QuestionItem = {
      id: `question-${Date.now()}`,
      title: questionDraft.trim(),
      categoryId: form.categoryId,
      replies: 0,
      status: '待解答',
      detail: '来自我的提问，等待匠友补充经验。',
    }
    setLocalQuestions((current) => [nextQuestion, ...current])
    setQuestionDraft('')
    showToast('问题已发布')
  }

  const installApp = async () => {
    if (!installPrompt) {
      showToast('浏览器菜单中也可以安装到桌面')
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
      showToast('已开始安装')
    }
  }

  const handleUpload = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('当前版本先支持图片预览')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setForm((current) => ({ ...current, imageData: String(reader.result) }))
      setReview(null)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => switchPage('home')} aria-label="返回首页">
          <span className="brand-mark">
            <Scissors size={22} />
          </span>
          <span>
            <strong>拾匠</strong>
            <small>纯净手工教程分享平台</small>
          </span>
        </button>

        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => switchPage('category')}
            placeholder="搜索剪纸、蓝染、木作..."
            aria-label="搜索手工教程"
          />
        </label>

        <div className="header-actions">
          <CloudBadge source={cloudSource} url={cloudUrl} />
          <button className="ghost-button" onClick={installApp}>
            <PackageOpen size={17} />
            安装
          </button>
          <button className="primary-button" onClick={() => switchPage('publish')}>
            <Plus size={17} />
            发布作品
          </button>
        </div>
      </header>

      <nav className="nav-tabs" aria-label="应用板块">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={activePage === key ? 'active' : ''}
            onClick={() => switchPage(key)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      <main className="page-wrap">
        {activePage === 'home' && (
          <HomePage
            data={cloudData}
            categoriesById={categoriesById}
            featuredTutorials={featuredTutorials}
            selectedTutorial={selectedTutorial}
            favoriteSet={favoriteSet}
            likedSet={likedSet}
            onCategory={applyCategory}
            onSelectTutorial={setSelectedTutorialId}
            onFavorite={toggleFavorite}
            onLike={toggleLike}
            onPublish={() => switchPage('publish')}
            onChina={() => switchPage('chinaCraft')}
          />
        )}

        {activePage === 'category' && (
          <CategoryPage
            categories={cloudData.categories}
            tutorials={filteredTutorials}
            selectedCategoryId={selectedCategoryId}
            categoriesById={categoriesById}
            favoriteSet={favoriteSet}
            likedSet={likedSet}
            blockedKeywords={cloudData.blockedKeywords}
            onCategory={setSelectedCategoryId}
            onSelectTutorial={setSelectedTutorialId}
            onFavorite={toggleFavorite}
            onLike={toggleLike}
          />
        )}

        {activePage === 'chinaCraft' && (
          <ChinaCraftPage
            data={cloudData}
            categoriesById={categoriesById}
            favoriteSet={favoriteSet}
            likedSet={likedSet}
            onCategory={(id) => applyCategory(id, 'category')}
            onSelectTutorial={setSelectedTutorialId}
            onFavorite={toggleFavorite}
            onLike={toggleLike}
            onToast={showToast}
          />
        )}

        {activePage === 'publish' && (
          <PublishPage
            categories={cloudData.categories}
            currentKind={currentKind}
            form={form}
            review={review}
            onForm={setForm}
            onReview={runReview}
            onPublish={publishWork}
            onUpload={handleUpload}
          />
        )}

        {activePage === 'qa' && (
          <QaPage
            questions={questions}
            categoriesById={categoriesById}
            questionDraft={questionDraft}
            onQuestionDraft={setQuestionDraft}
            onSubmitQuestion={submitQuestion}
          />
        )}

        {activePage === 'mine' && (
          <MinePage
            tutorials={allTutorials}
            publishedWorks={publishedWorks}
            favoriteIds={favoriteIds}
            traditionalCount={traditionalCount}
            onInstall={installApp}
            onPublish={() => switchPage('publish')}
            onOpenTutorial={(id) => {
              setSelectedTutorialId(id)
              switchPage('home')
            }}
          />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function HomePage({
  data,
  categoriesById,
  featuredTutorials,
  selectedTutorial,
  favoriteSet,
  likedSet,
  onCategory,
  onSelectTutorial,
  onFavorite,
  onLike,
  onPublish,
  onChina,
}: {
  data: CloudData
  categoriesById: Map<string, CraftCategory>
  featuredTutorials: Tutorial[]
  selectedTutorial: Tutorial
  favoriteSet: Set<string>
  likedSet: Set<string>
  onCategory: (categoryId: string, page?: PageKey) => void
  onSelectTutorial: (tutorialId: string) => void
  onFavorite: (tutorialId: string) => void
  onLike: (tutorialId: string) => void
  onPublish: () => void
  onChina: () => void
}) {
  return (
    <div className="home-layout">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">
            <ShieldCheck size={16} />
            AI合规预审
          </span>
          <h1>让手工教程回到制作本身</h1>
          <p>只收录手作、传统国风与非遗内容。浏览、收藏、提问、发布预审和离线安装都已经接入。</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onPublish}>
              <PenLine size={17} />
              发布教程
            </button>
            <button className="ghost-button" onClick={onChina}>
              <Landmark size={17} />
              传统国风专区
            </button>
          </div>
        </div>
        <img src={assetUrl('assets/crafts/hero-craft.png')} alt="手工工具与传统纹样组合" />
      </section>

      <section className="notice-strip">
        <CircleAlert size={18} />
        <span>仅可发布手工与传统国风非遗内容；美食、游戏、自拍、带货等内容会被预审拦截。</span>
      </section>

      <section className="challenge-panel">
        <div>
          <span className="section-kicker">
            <Award size={15} />
            本周活动
          </span>
          <h2>{data.challenge.title}</h2>
          <p>{data.challenge.description}</p>
        </div>
        <div className="challenge-meter" aria-label="7天打卡">
          {Array.from({ length: data.challenge.days }, (_, index) => (
            <span key={index} className={index < 3 ? 'done' : ''}>
              {index + 1}
            </span>
          ))}
        </div>
        <strong>{data.challenge.reward}</strong>
      </section>

      <div className="content-grid">
        <section>
          <SectionTitle icon={Sparkles} title="精选手工教程" action="查看全部" />
          <div className="tutorial-grid">
            {featuredTutorials.map((tutorial) => (
              <TutorialCard
                key={tutorial.id}
                tutorial={tutorial}
                category={categoriesById.get(tutorial.categoryId)}
                selected={selectedTutorial.id === tutorial.id}
                liked={likedSet.has(tutorial.id)}
                favorite={favoriteSet.has(tutorial.id)}
                onOpen={() => onSelectTutorial(tutorial.id)}
                onLike={() => onLike(tutorial.id)}
                onFavorite={() => onFavorite(tutorial.id)}
              />
            ))}
          </div>
        </section>

        <TutorialDetail
          tutorial={selectedTutorial}
          category={categoriesById.get(selectedTutorial.categoryId)}
          favorite={favoriteSet.has(selectedTutorial.id)}
          liked={likedSet.has(selectedTutorial.id)}
          onLike={() => onLike(selectedTutorial.id)}
          onFavorite={() => onFavorite(selectedTutorial.id)}
        />
      </div>

      <section>
        <SectionTitle icon={NotebookTabs} title="快速进入分类" />
        <div className="category-row">
          {data.categories.slice(0, 8).map((category) => (
            <CategoryChip key={category.id} category={category} onClick={() => onCategory(category.id)} />
          ))}
        </div>
      </section>
    </div>
  )
}

function CategoryPage({
  categories,
  tutorials,
  selectedCategoryId,
  categoriesById,
  favoriteSet,
  likedSet,
  blockedKeywords,
  onCategory,
  onSelectTutorial,
  onFavorite,
  onLike,
}: {
  categories: CraftCategory[]
  tutorials: Tutorial[]
  selectedCategoryId: string
  categoriesById: Map<string, CraftCategory>
  favoriteSet: Set<string>
  likedSet: Set<string>
  blockedKeywords: string[]
  onCategory: (categoryId: string) => void
  onSelectTutorial: (tutorialId: string) => void
  onFavorite: (tutorialId: string) => void
  onLike: (tutorialId: string) => void
}) {
  return (
    <div className="stack">
      <section>
        <SectionTitle icon={LayoutGrid} title="手工分类" />
        <div className="filter-bar">
          <button className={selectedCategoryId === 'all' ? 'active' : ''} onClick={() => onCategory('all')}>
            全部
          </button>
          <button
            className={selectedCategoryId === 'traditional' ? 'active china' : ''}
            onClick={() => onCategory('traditional')}
          >
            传统国风
          </button>
          <button
            className={selectedCategoryId === 'general' ? 'active' : ''}
            onClick={() => onCategory('general')}
          >
            通用手作
          </button>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              active={selectedCategoryId === category.id}
              onClick={() => onCategory(category.id)}
            />
          ))}
        </div>
      </section>

      <section className="compliance-panel">
        <div>
          <span className="section-kicker">
            <ShieldCheck size={15} />
            发布边界
          </span>
          <h2>AI识别拦截清单</h2>
          <p>传统非遗手工全部进入白名单；无制作过程的内容不会开放发布。</p>
        </div>
        <div className="blocked-list">
          {blockedKeywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle icon={BookOpen} title="分类教程" action={`${tutorials.length} 条`} />
        <div className="tutorial-grid wide">
          {tutorials.map((tutorial) => (
            <TutorialCard
              key={tutorial.id}
              tutorial={tutorial}
              category={categoriesById.get(tutorial.categoryId)}
              selected={false}
              liked={likedSet.has(tutorial.id)}
              favorite={favoriteSet.has(tutorial.id)}
              onOpen={() => onSelectTutorial(tutorial.id)}
              onLike={() => onLike(tutorial.id)}
              onFavorite={() => onFavorite(tutorial.id)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function ChinaCraftPage({
  data,
  categoriesById,
  favoriteSet,
  likedSet,
  onCategory,
  onSelectTutorial,
  onFavorite,
  onLike,
  onToast,
}: {
  data: CloudData
  categoriesById: Map<string, CraftCategory>
  favoriteSet: Set<string>
  likedSet: Set<string>
  onCategory: (categoryId: string) => void
  onSelectTutorial: (tutorialId: string) => void
  onFavorite: (tutorialId: string) => void
  onLike: (tutorialId: string) => void
  onToast: (message: string) => void
}) {
  const chinaCategories = data.categories.filter((category) => category.kind === '传统国风非遗')
  const chinaTutorials = data.tutorials.filter((tutorial) => tutorial.kind === '传统国风非遗')

  return (
    <div className="stack">
      <section className="china-hero">
        <div>
          <span className="eyebrow red">
            <Landmark size={16} />
            中华传统非遗手工专区
          </span>
          <h1>剪纸、缠花、扎染、篆刻与花灯</h1>
          <p>每个教程都附带文化科普、材料清单和分步制作过程。</p>
        </div>
        <img src={assetUrl('assets/crafts/china-craft.png')} alt="传统国风手工材料" />
      </section>

      <section>
        <SectionTitle icon={Clock3} title="传统节日手工专题" />
        <div className="festival-grid">
          {data.festivalTopics.map((topic) => (
            <button key={topic.id} onClick={() => onCategory(topic.categoryId)}>
              <strong>{topic.title}</strong>
              <span>{topic.subtitle}</span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle icon={Leaf} title="非遗手工分类" />
        <div className="category-grid">
          {chinaCategories.map((category) => (
            <CategoryCard key={category.id} category={category} active={false} onClick={() => onCategory(category.id)} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle icon={Star} title="非遗精选教程" />
        <div className="tutorial-grid wide">
          {chinaTutorials.map((tutorial) => (
            <TutorialCard
              key={tutorial.id}
              tutorial={tutorial}
              category={categoriesById.get(tutorial.categoryId)}
              selected={false}
              liked={likedSet.has(tutorial.id)}
              favorite={favoriteSet.has(tutorial.id)}
              onOpen={() => onSelectTutorial(tutorial.id)}
              onLike={() => onLike(tutorial.id)}
              onFavorite={() => onFavorite(tutorial.id)}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle icon={PackageOpen} title="传统手工材料互换" action="禁止金钱交易" />
        <div className="exchange-grid">
          {data.exchanges.map((item) => (
            <article key={item.id} className="exchange-card">
              <img src={assetUrl(item.image)} alt={item.title} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.material}</p>
                <span>{item.location}</span>
                <button onClick={() => onToast('已记录互换意向')}>发布互换意向</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function PublishPage({
  categories,
  currentKind,
  form,
  review,
  onForm,
  onReview,
  onPublish,
  onUpload,
}: {
  categories: CraftCategory[]
  currentKind: CraftKind
  form: PublishForm
  review: AiReviewResult | null
  onForm: (updater: PublishForm | ((current: PublishForm) => PublishForm)) => void
  onReview: () => void
  onPublish: () => void
  onUpload: (file: File | undefined) => void
}) {
  const canPublish = Boolean(review?.passed && form.title.trim())

  return (
    <section className="publish-layout">
      <div className="publish-panel">
        <SectionTitle icon={Upload} title="发布手工教程" action={currentKind} />
        <label className="upload-area">
          {form.imageData ? (
            <img src={form.imageData} alt="上传预览" />
          ) : (
            <>
              <Camera size={38} />
              <span>上传作品图片</span>
            </>
          )}
          <input type="file" accept="image/*" onChange={(event) => onUpload(event.target.files?.[0])} />
        </label>

        <div className="form-grid">
          <label>
            作品名称
            <input
              value={form.title}
              onChange={(event) => onForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="例如：端午艾草香囊制作"
            />
          </label>
          <label>
            手工分类
            <select
              value={form.categoryId}
              onChange={(event) => onForm((current) => ({ ...current, categoryId: event.target.value }))}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.kind} / {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            材料清单
            <textarea
              value={form.materials}
              onChange={(event) => onForm((current) => ({ ...current, materials: event.target.value }))}
              placeholder="宣纸、剪刀、刻刀垫板、铅笔..."
            />
          </label>
          <label>
            分步制作过程
            <textarea
              value={form.steps}
              onChange={(event) => onForm((current) => ({ ...current, steps: event.target.value }))}
              placeholder={'1. 折出中心轴\n2. 描线定位\n3. 先刻内部细节'}
            />
          </label>
          <label className="wide-field">
            非遗文化介绍或制作心得
            <textarea
              value={form.note}
              onChange={(event) => onForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="传统手工可补充民俗来源、纹样寓意或安全提示"
            />
          </label>
        </div>

        <div className="publish-actions">
          <button className="ghost-button" onClick={onReview}>
            <Sparkles size={17} />
            AI内容预审
          </button>
          <button className="primary-button" disabled={!canPublish} onClick={onPublish}>
            <Send size={17} />
            发布作品
          </button>
        </div>
      </div>

      <aside className="review-panel">
        <h2>预审结果</h2>
        {review ? (
          <div className={review.passed ? 'review-result pass' : 'review-result fail'}>
            {review.passed ? <CircleCheck size={28} /> : <CircleX size={28} />}
            <strong>{review.title}</strong>
            <p>{review.message}</p>
            <div className="score-ring">{review.score}</div>
            <div className="keyword-row">
              {review.matched.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-review">
            <ShieldCheck size={32} />
            <p>填写作品名称、材料和步骤后进行预审。</p>
          </div>
        )}
      </aside>
    </section>
  )
}

function QaPage({
  questions,
  categoriesById,
  questionDraft,
  onQuestionDraft,
  onSubmitQuestion,
}: {
  questions: QuestionItem[]
  categoriesById: Map<string, CraftCategory>
  questionDraft: string
  onQuestionDraft: (value: string) => void
  onSubmitQuestion: () => void
}) {
  return (
    <div className="qa-layout">
      <section className="ask-panel">
        <SectionTitle icon={MessageCircle} title="匠友问答" action={`${questions.length} 个问题`} />
        <div className="ask-inline">
          <input
            value={questionDraft}
            onChange={(event) => onQuestionDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSubmitQuestion()
            }}
            placeholder="输入你的手工难题"
          />
          <button className="primary-button" onClick={onSubmitQuestion}>
            <Send size={17} />
            提问
          </button>
        </div>
      </section>

      <section className="question-list">
        {questions.map((question) => {
          const category = categoriesById.get(question.categoryId)
          return (
            <article key={question.id} className="question-card">
              <div>
                <span className={question.status === '已采纳' ? 'status accepted' : 'status'}>{question.status}</span>
                <h3>{question.title}</h3>
                <p>{question.detail}</p>
              </div>
              <footer>
                <span>{category?.name ?? '手工分类'}</span>
                <span>{question.replies} 条回复</span>
              </footer>
            </article>
          )
        })}
      </section>
    </div>
  )
}

function MinePage({
  tutorials,
  publishedWorks,
  favoriteIds,
  traditionalCount,
  onInstall,
  onPublish,
  onOpenTutorial,
}: {
  tutorials: Tutorial[]
  publishedWorks: PublishedWork[]
  favoriteIds: string[]
  traditionalCount: number
  onInstall: () => void
  onPublish: () => void
  onOpenTutorial: (tutorialId: string) => void
}) {
  const favorites = tutorials.filter((tutorial) => favoriteIds.includes(tutorial.id))

  return (
    <div className="mine-layout">
      <section className="profile-panel">
        <div className="avatar">
          <UserRound size={38} />
        </div>
        <h2>手工爱好者</h2>
        <p>发布作品 {publishedWorks.length} 件 · 收藏 {favorites.length} 件 · 传统国风 {traditionalCount} 件</p>
        <div className="profile-actions">
          <button className="primary-button" onClick={onPublish}>
            <Plus size={17} />
            继续发布
          </button>
          <button className="ghost-button" onClick={onInstall}>
            <PackageOpen size={17} />
            安装拾匠
          </button>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard icon={BookOpen} label="全部教程" value={tutorials.length} />
        <StatCard icon={Landmark} label="非遗内容" value={traditionalCount} />
        <StatCard icon={Bookmark} label="我的收藏" value={favorites.length} />
        <StatCard icon={Award} label="打卡天数" value={Math.min(7, publishedWorks.length + 3)} />
      </section>

      <section>
        <SectionTitle icon={NotebookTabs} title="我的作品" action={`${publishedWorks.length} 件`} />
        {publishedWorks.length ? (
          <div className="work-list">
            {publishedWorks.map((work) => (
              <article key={work.id} className="work-card">
                <img src={work.imageData || assetUrl('assets/crafts/user-work.png')} alt={work.title} />
                <div>
                  <h3>{work.title}</h3>
                  <p>{work.kind} · AI分 {work.aiScore}</p>
                  <span>{new Date(work.createdAt).toLocaleString('zh-CN')}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={PenLine} text="还没有发布作品" />
        )}
      </section>

      <section>
        <SectionTitle icon={Bookmark} title="我的收藏" action={`${favorites.length} 件`} />
        {favorites.length ? (
          <div className="favorite-list">
            {favorites.map((tutorial) => (
              <button key={tutorial.id} onClick={() => onOpenTutorial(tutorial.id)}>
                <img src={assetUrl(tutorial.image)} alt={tutorial.title} />
                <span>{tutorial.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={Bookmark} text="收藏教程后会出现在这里" />
        )}
      </section>
    </div>
  )
}

function TutorialCard({
  tutorial,
  category,
  selected,
  liked,
  favorite,
  onOpen,
  onLike,
  onFavorite,
}: {
  tutorial: Tutorial
  category?: CraftCategory
  selected: boolean
  liked: boolean
  favorite: boolean
  onOpen: () => void
  onLike: () => void
  onFavorite: () => void
}) {
  return (
    <article className={`tutorial-card ${selected ? 'selected' : ''}`}>
      <button className="image-button" onClick={onOpen}>
        <img src={assetUrl(tutorial.image)} alt={tutorial.title} />
        <span className={tutorial.kind === '传统国风非遗' ? 'kind-badge china' : 'kind-badge'}>
          {tutorial.kind}
        </span>
      </button>
      <div className="tutorial-body">
        <button className="title-button" onClick={onOpen}>
          {tutorial.title}
        </button>
        <p>{tutorial.summary}</p>
        <div className="meta-row">
          <span style={{ color: category?.accent }}>{category?.name ?? '手工'}</span>
          <span>{difficultyText(tutorial.difficulty)}</span>
        </div>
        <div className="card-actions">
          <button className={liked ? 'active' : ''} onClick={onLike} aria-label="点赞">
            <Heart size={16} />
            {tutorial.likes + (liked ? 1 : 0)}
          </button>
          <button className={favorite ? 'active' : ''} onClick={onFavorite} aria-label="收藏">
            <Bookmark size={16} />
            {tutorial.saves + (favorite ? 1 : 0)}
          </button>
        </div>
      </div>
    </article>
  )
}

function TutorialDetail({
  tutorial,
  category,
  favorite,
  liked,
  onFavorite,
  onLike,
}: {
  tutorial: Tutorial
  category?: CraftCategory
  favorite: boolean
  liked: boolean
  onFavorite: () => void
  onLike: () => void
}) {
  return (
    <aside className="detail-panel">
      <img src={assetUrl(tutorial.image)} alt={tutorial.title} />
      <div className="detail-content">
        <span className="section-kicker" style={{ color: category?.accent }}>
          <BadgeCheck size={15} />
          {category?.name ?? tutorial.kind}
        </span>
        <h2>{tutorial.title}</h2>
        <p>{tutorial.summary}</p>
        <div className="detail-metrics">
          <span>
            <Clock3 size={15} />
            {tutorial.duration}
          </span>
          <span>
            <Star size={15} />
            {difficultyText(tutorial.difficulty)}
          </span>
          <span>
            <Users size={15} />
            {tutorial.author}
          </span>
        </div>
        <h3>材料</h3>
        <div className="keyword-row">
          {tutorial.materials.map((material) => (
            <span key={material}>{material}</span>
          ))}
        </div>
        <h3>步骤</h3>
        <ol className="step-list">
          {tutorial.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {tutorial.heritageNote && <p className="heritage-note">{tutorial.heritageNote}</p>}
        <div className="detail-actions">
          <button className={liked ? 'ghost-button active' : 'ghost-button'} onClick={onLike}>
            <Heart size={17} />
            点赞
          </button>
          <button className={favorite ? 'ghost-button active' : 'ghost-button'} onClick={onFavorite}>
            <Bookmark size={17} />
            收藏
          </button>
          <button className="ghost-button">
            <Share2 size={17} />
            分享
          </button>
        </div>
      </div>
    </aside>
  )
}

function CategoryCard({
  category,
  active,
  onClick,
}: {
  category: CraftCategory
  active: boolean
  onClick: () => void
}) {
  return (
    <button className={`category-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="category-icon" style={{ color: category.accent, background: `${category.accent}18` }}>
        {category.icon}
      </span>
      <strong>{category.name}</strong>
      <small>{category.description}</small>
    </button>
  )
}

function CategoryChip({ category, onClick }: { category: CraftCategory; onClick: () => void }) {
  return (
    <button className="category-chip" onClick={onClick} style={{ borderColor: `${category.accent}55` }}>
      <span style={{ background: `${category.accent}20`, color: category.accent }}>{category.icon}</span>
      {category.name}
    </button>
  )
}

function CloudBadge({ source, url }: { source: 'cloud' | 'fallback'; url: string }) {
  const isCloud = source === 'cloud'
  return (
    <span className={isCloud ? 'cloud-badge online' : 'cloud-badge'} title={url || '本地兜底数据'}>
      {isCloud ? <Wifi size={15} /> : <WifiOff size={15} />}
      {isCloud ? '云端数据' : '离线数据'}
    </span>
  )
}

function SectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon
  title: string
  action?: string
}) {
  return (
    <div className="section-title">
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      {action && <span>{action}</span>}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <article className="stat-card">
      <Icon size={22} />
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="empty-state">
      <Icon size={30} />
      <p>{text}</p>
    </div>
  )
}

function difficultyText(value: Tutorial['difficulty']) {
  return `${value}星难度`
}

function assetUrl(path: string) {
  if (path.startsWith('data:') || path.startsWith('http')) return path
  return `${baseUrl}${path}`.replace(/\/{2,}/g, '/')
}

function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  })

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}

export default App
