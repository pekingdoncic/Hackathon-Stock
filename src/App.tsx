import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { stocks, sectors, type Stock } from './stocks'

type MainView = 'learn' | 'room' | 'mine'
type RoomView = 'lobby' | 'tavern' | 'market'
type ModalView = 'news' | 'stocks' | 'stockDetail' | 'finale' | null
type AgentKey = 'buffett' | 'duan' | 'feng'

type Holding = {
  shares: number
  cost: number // 累计买入成本（用于计算盈亏）
}

type TradeLog = {
  type: 'buy' | 'sell'
  name: string
  code: string
  shares: number
  amount: number
}

type Portfolio = {
  cash: number
  holdings: Record<string, Holding>
  lastTrade: TradeLog | null
}

const INITIAL_CASH = 100000

type Player = {
  id: string
  name: string
  avatar: string
  undercover?: boolean
  profit: number
  suspicion: number
  speech: string
  move: string
  trend: number[]
}

const players: Player[] = [
  { id: 'p1', name: '张三', avatar: 'ZS', profit: -8.6, suspicion: 32, speech: '我没上头，我只是提前相信。', move: '追入量子科技，尾盘回撤 6.2%。', trend: [42, 46, 38, 31, 29] },
  { id: 'p2', name: '李四', avatar: 'LS', profit: 12.8, suspicion: 18, speech: '先别急着喊股神，收盘再说。', move: '减仓新能源车，避开午后跳水。', trend: [31, 36, 39, 48, 55] },
  { id: 'p3', name: '王五', avatar: 'WW', undercover: true, profit: 2.4, suspicion: 68, speech: '市场传闻嘛，听听就好。', move: '利好出现前建仓，追入后减仓。', trend: [34, 35, 34, 36, 37] },
  { id: 'p4', name: '赵六', avatar: 'ZL', profit: -14.2, suspicion: 25, speech: '这把我先把节目效果拉满。', move: '连续两日跟风，账户曲线跳水。', trend: [45, 39, 31, 25, 21] },
]

const news = [
  { tag: '市场传闻', text: '量子科技午后出现资金异动，短线情绪升温。', tone: 'up', mark: '?' },
  { tag: '公司动态', text: 'AI 芯片披露产能排期，交付节奏仍待观察。', tone: 'watch' },
  { tag: '资金异动', text: '新能源车尾盘承接增强，机构席位小幅回补。', tone: 'up' },
  { tag: '盘中快讯', text: '云游戏板块成交放大，追高情绪开始降温。', tone: 'down' },
]

const reports = [
  '李四今天赚得安静，像是提前看过剧本。',
  '张三这笔追高，不能说没判断，只能说判断来得太晚。',
  '王五收益平平，嫌疑值却一路抬头。',
]

const agents: Record<AgentKey, { name: string; avatar: string; line: string; tip: string }> = {
  buffett: {
    name: '巴菲特',
    avatar: 'BF',
    line: '先别问能赚多少，先问你能不能睡着。',
    tip: '偏长期、仓位、风险边界。',
  },
  duan: {
    name: '段永平',
    avatar: 'DY',
    line: '看不懂就别动，能不亏也是本事。',
    tip: '偏常识、好生意、少犯错。',
  },
  feng: {
    name: '峰哥',
    avatar: 'FG',
    line: '这消息味儿太冲，先看谁最想让你信。',
    tip: '偏识谎、节奏、熟人局推理。',
  },
}

function MiniChart({ values }: { values: number[] }) {
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 100},${100 - value}`)
    .join(' ')

  return (
    <svg className="mini-chart" viewBox="0 0 100 100" aria-hidden="true">
      <polyline points={points} />
    </svg>
  )
}

type Candle = {
  open: number
  close: number
  high: number
  low: number
  up: boolean
}

// 基于字符串生成稳定种子，保证同一只股票 K 线形态固定、不同股票各不相同
function seedFrom(text: string) {
  let h = 1779033703 ^ text.length
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

// mulberry32：轻量可复现伪随机数生成器
function makeRng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const VOL_LEVEL: Record<string, number> = {
  低: 0.012,
  中低: 0.018,
  中: 0.026,
  中高: 0.036,
  高: 0.05,
  极高: 0.075,
}

// 用随机游走生成合理的 OHLC 蜡烛序列：
// - 波动幅度由 volatility 档位决定
// - 整体趋势方向与当日涨跌 change 挂钩
// - 末根收盘价对齐到当前价 price
function buildCandles(stock: Stock, count = 22): Candle[] {
  const rng = makeRng(seedFrom(stock.code))
  const vol = VOL_LEVEL[stock.volatility] ?? 0.03
  // 反推起点：当日涨跌为正说明这段时间总体在涨，从更低位起步
  const drift = (stock.change / 100) / count
  let price = stock.price / (1 + stock.change / 100)
  if (!Number.isFinite(price) || price <= 0) price = stock.price

  const candles: Candle[] = []
  for (let i = 0; i < count; i++) {
    const open = price
    // 单根随机游走 + 趋势漂移
    const shock = (rng() - 0.5) * 2 * vol
    let close = open * (1 + drift + shock)
    if (close <= 0) close = open * 0.97
    const body = Math.abs(close - open)
    // 影线长度，随机但不超过实体的合理倍数
    const upWick = (rng() * 0.6 + 0.1) * (body + open * vol * 0.5)
    const downWick = (rng() * 0.6 + 0.1) * (body + open * vol * 0.5)
    const high = Math.max(open, close) + upWick
    const low = Math.max(0.01, Math.min(open, close) - downWick)
    candles.push({ open, close, high, low, up: close >= open })
    price = close
  }
  // 末根收盘对齐到真实价格，让图表与上方报价一致
  const last = candles[candles.length - 1]
  last.close = stock.price
  last.up = last.close >= last.open
  last.high = Math.max(last.high, last.open, last.close)
  last.low = Math.min(last.low, last.open, last.close)
  return candles
}

function CandleChart({ stock }: { stock: Stock }) {
  const candles = useMemo(() => buildCandles(stock), [stock])
  const max = Math.max(...candles.map((c) => c.high))
  const min = Math.min(...candles.map((c) => c.low))
  const span = max - min || 1
  const pct = (v: number) => ((v - min) / span) * 100

  return (
    <div className="candles tall-candles">
      {candles.map((c, index) => {
        const bodyTop = pct(Math.max(c.open, c.close))
        const bodyBottom = pct(Math.min(c.open, c.close))
        return (
          <span className={`candle ${c.up ? 'candle-up' : 'candle-down'}`} key={index}>
            <i
              className="candle-wick"
              style={{ bottom: `${pct(c.low)}%`, height: `${pct(c.high) - pct(c.low)}%` }}
            />
            <i
              className="candle-body"
              style={{ bottom: `${bodyBottom}%`, height: `${Math.max(1.5, bodyTop - bodyBottom)}%` }}
            />
          </span>
        )
      })}
    </div>
  )
}

function RoomLobby({ startGame }: { startGame: () => void }) {
  const [invited, setInvited] = useState(false)

  const invite = async () => {
    const code = 'GOD-531'
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`房间码 ${code}，一起来玩《我不是股神》`)
      }
    } catch {
      // 忽略剪贴板异常，仍给出反馈
    }
    setInvited(true)
    window.setTimeout(() => setInvited(false), 2000)
  }

  return (
    <main className="screen-body">
      <section className="cg-panel pixel-panel">
        <span className="eyebrow">今晚开局</span>
        <h2>市场里混进了一个会讲故事的人</h2>
        <p>真实新闻、市场传闻和朋友的判断，都会改变这一局的走向。</p>
      </section>

      <section className="hero-panel pixel-panel">
        <div className="room-code">
          <span>熟人房间</span>
          <strong>GOD-531</strong>
        </div>
        <h1>我不是股神</h1>
        <p>白天交易，晚上盘问。有人在赚钱，有人在带节奏。</p>
        <div className="hero-actions">
          <button className="primary-button" onClick={startGame} type="button">开启房间</button>
          <button className="secondary-button" onClick={invite} type="button">{invited ? '房间码已复制' : '邀请好友'}</button>
        </div>
      </section>

      <section className="pixel-panel">
        <div className="section-title">
          <span>局型</span>
          <b>5-8 人</b>
        </div>
        <div className="rule-grid">
          <div><strong>5</strong><span>回合</span></div>
          <div><strong>1</strong><span>卧底</span></div>
          <div><strong>2</strong><span>假消息</span></div>
        </div>
      </section>

      <section className="pixel-panel flow-panel">
        <div className="section-title">
          <span>今日流程</span>
          <b>轻策略</b>
        </div>
        {['邀请入局', '暗发身份', '白天交易', '夜晚发言', '投嫌疑票', '终局揭晓'].map((item, index) => (
          <div className="flow-step" key={item}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <b>{item}</b>
          </div>
        ))}
      </section>
    </main>
  )
}

function Tavern({ openModal }: { openModal: (view: ModalView) => void }) {
  const [selectedPlayer, setSelectedPlayer] = useState(players[2])
  const [speaking, setSpeaking] = useState(false)
  const [votedFor, setVotedFor] = useState<string | null>(null)
  const suspect = useMemo(() => [...players].sort((a, b) => b.suspicion - a.suspicion)[0], [])

  return (
    <main className="screen-body immersive-body">
      <section className="pixel-panel tavern-stage">
        <span className="eyebrow">小酒馆</span>
        <h2>AI 主持人开麦</h2>
        <p>“有人赚得安静，有人亏得响亮。谁先上车，谁又悄悄下车？”</p>
        <div className="round-progress">
          {Array.from({ length: 5 }).map((_, index) => <i className={index < 4 ? 'done' : ''} key={index} />)}
        </div>
      </section>

      <section className="pixel-panel">
        <div className="section-title">
          <span>玩家发言</span>
          <b>轮到 {selectedPlayer.name}</b>
        </div>
        <div className="player-grid">
          {players.map((player) => (
            <button className={`player-card ${selectedPlayer.id === player.id ? 'active' : ''}`} key={player.id} onClick={() => setSelectedPlayer(player)} type="button">
              <div className="avatar">{player.avatar}</div>
              <div>
                <strong>{player.name}</strong>
                <p>{player.speech}</p>
              </div>
              <MiniChart values={player.trend} />
            </button>
          ))}
        </div>
        <div className="voice-strip">
          <button
            className={`voice-button ${speaking ? 'active' : ''}`}
            type="button"
            onMouseDown={() => setSpeaking(true)}
            onMouseUp={() => setSpeaking(false)}
            onMouseLeave={() => setSpeaking(false)}
            onTouchStart={() => setSpeaking(true)}
            onTouchEnd={() => setSpeaking(false)}
          >
            {speaking ? '正在发言…' : '按住发言'}
          </button>
        </div>
      </section>

      <section className="pixel-panel">
        <div className="section-title">
          <span>操作痕迹</span>
          <b>{selectedPlayer.name}</b>
        </div>
        <div className="detail-note">
          <p>{selectedPlayer.move}</p>
          <MiniChart values={selectedPlayer.trend} />
        </div>
      </section>

      <section className="pixel-panel report-compact">
        <div className="section-title">
          <span>上回合战报</span>
          <b>AI</b>
        </div>
        {reports.map((line) => <p key={line}>{line}</p>)}
      </section>

      <section className="pixel-panel vote-panel">
        <div className="section-title">
          <span>嫌疑票</span>
          <b>最高 {suspect.suspicion}</b>
        </div>
        <div className="suspect">
          <div className="avatar warn">{suspect.avatar}</div>
          <div>
            <strong>{suspect.name}</strong>
            <p>{suspect.move}</p>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={() => setVotedFor(suspect.id)}>
            {votedFor === suspect.id ? `已投 ${suspect.name}` : '投他'}
          </button>
          <button className="secondary-button" onClick={() => openModal('finale')} type="button">终局</button>
        </div>
      </section>
    </main>
  )
}

function NewsPage() {
  return (
    <main className="screen-body immersive-body page-view">
      <section className="pixel-panel page-head">
        <h2>新闻板块</h2>
        <p>真假消息混在一起，先看时点，再看谁受益。</p>
      </section>
      <section className="pixel-panel news-page-list">
        {news.map((item) => (
          <article className="news-card" key={item.text}>
            <div>
              <span className={`tag ${item.tone}`}>{item.tag}</span>
              {item.mark && <span className="risk-dot">{item.mark}</span>}
            </div>
            <p>{item.text}</p>
          </article>
        ))}
      </section>
    </main>
  )
}

const volClass = (v: string) => {
  if (v === '极高' || v === '高') return 'vol-high'
  if (v === '中高') return 'vol-mid'
  return 'vol-low'
}

function StocksPage({ pickStock }: { pickStock: (stock: Stock) => void }) {
  const [sector, setSector] = useState<string>('全部')
  const list = useMemo(
    () => (sector === '全部' ? stocks : stocks.filter((s) => s.sector === sector)),
    [sector],
  )

  return (
    <main className="screen-body immersive-body page-view">
      <section className="pixel-panel page-head">
        <h2>选股板块</h2>
        <p>共 {stocks.length} 支个股，点击查看基本面、估值与公司动态。</p>
      </section>

      <section className="pixel-panel sector-bar">
        <div className="sector-tabs">
          <button
            className={sector === '全部' ? 'active' : ''}
            onClick={() => setSector('全部')}
            type="button"
          >
            全部
          </button>
          {sectors.map((name) => (
            <button
              className={sector === name ? 'active' : ''}
              key={name}
              onClick={() => setSector(name)}
              type="button"
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      <section className="pixel-panel stock-page-list">
        {list.map((stock) => (
          <button className="stock-row stock-card" key={stock.code} onClick={() => pickStock(stock)} type="button">
            <span className="stock-main">
              <b>{stock.name}</b>
              <small>{stock.realName} · {stock.sector}</small>
              <span className="stock-meta">
                <em className={`vol-chip ${volClass(stock.volatility)}`}>波动 {stock.volatility}</em>
                <em className="heat-chip">热度 {stock.heat}</em>
              </span>
            </span>
            <span className="stock-quote">
              <strong className={stock.change > 0 ? 'rise' : 'fall'}>
                {stock.change > 0 ? '+' : ''}{stock.change}%
              </strong>
              <small>{stock.price.toFixed(2)}</small>
            </span>
          </button>
        ))}
      </section>
    </main>
  )
}

function StockDetail({
  stock,
  back,
  portfolio,
  onTrade,
}: {
  stock: Stock
  back: () => void
  portfolio: Portfolio
  onTrade: (stock: Stock, type: 'buy' | 'sell', shares: number) => string
}) {
  const [shares, setShares] = useState(100)
  const [tip, setTip] = useState<string | null>(null)

  const holding = portfolio.holdings[stock.code]
  const heldShares = holding ? holding.shares : 0
  const avgCost = holding && holding.shares > 0 ? holding.cost / holding.shares : 0
  const marketValue = heldShares * stock.price
  const profit = heldShares > 0 ? marketValue - holding!.cost : 0
  const profitPct = heldShares > 0 && holding!.cost > 0 ? (profit / holding!.cost) * 100 : 0

  const cost = shares * stock.price
  const maxBuy = Math.floor(portfolio.cash / stock.price)

  const adjust = (delta: number) => setShares((v) => Math.max(0, v + delta))

  const trade = (type: 'buy' | 'sell') => {
    if (shares <= 0) {
      setTip('请先输入买入/卖出股数')
      window.setTimeout(() => setTip(null), 1800)
      return
    }
    const msg = onTrade(stock, type, shares)
    setTip(msg)
    window.setTimeout(() => setTip(null), 2200)
  }

  const newsTones = ['up', 'watch', 'down']

  return (
    <main className="screen-body immersive-body page-view">
      <section className="pixel-panel page-head">
        <button className="text-link" onClick={back} type="button">返回选股</button>
        <h2>{stock.name}</h2>
        <p>{stock.realName} · {stock.sector}</p>
      </section>

      <section className="pixel-panel detail-panel">
        <div className="section-title">
          <span>K 线</span>
          <b className={stock.change > 0 ? 'rise' : 'fall'}>
            {stock.price.toFixed(2)} ({stock.change > 0 ? '+' : ''}{stock.change}%)
          </b>
        </div>
        <CandleChart stock={stock} />
        <div className="stat-grid">
          <div className="stat-cell">
            <small>波动</small>
            <b className={volClass(stock.volatility)}>{stock.volatility}</b>
          </div>
          <div className="stat-cell">
            <small>估值风险</small>
            <b>{stock.risk}</b>
          </div>
          <div className="stat-cell">
            <small>热度</small>
            <b>{stock.heat}</b>
          </div>
        </div>
        <div className="position-row">
          <div className="position-cell">
            <small>持仓股数</small>
            <b>{heldShares} 股</b>
          </div>
          <div className="position-cell">
            <small>成本价</small>
            <b>{avgCost > 0 ? avgCost.toFixed(2) : '—'}</b>
          </div>
          <div className="position-cell">
            <small>持仓盈亏</small>
            <b className={heldShares > 0 ? (profit >= 0 ? 'rise' : 'fall') : ''}>
              {heldShares > 0 ? `${profit >= 0 ? '+' : ''}${profit.toFixed(0)} (${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(1)}%)` : '—'}
            </b>
          </div>
        </div>

        <div className="trade-form">
          <div className="shares-line">
            <span className="shares-label">交易股数</span>
            <div className="shares-control">
              <button type="button" onClick={() => adjust(-100)}>-100</button>
              <input
                type="number"
                min={0}
                step={100}
                value={shares}
                onChange={(e) => setShares(Math.max(0, Number(e.target.value) || 0))}
              />
              <button type="button" onClick={() => adjust(100)}>+100</button>
            </div>
          </div>
          <div className="shares-quick">
            <button type="button" onClick={() => setShares(Math.min(maxBuy, 100))}>最少</button>
            <button type="button" onClick={() => setShares(Math.floor(maxBuy / 2))}>半仓</button>
            <button type="button" onClick={() => setShares(maxBuy)}>全仓</button>
            <button type="button" onClick={() => setShares(heldShares)} disabled={heldShares === 0}>全部持仓</button>
          </div>
          <div className="trade-summary">
            <span>预计金额 <b>{cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b></span>
            <span>可用现金 <b>{portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b></span>
          </div>
        </div>

        {tip && <p className="trade-tip">{tip}</p>}
        <div className="trade-actions">
          <button className="primary-button" type="button" onClick={() => trade('buy')}>买入 {shares} 股</button>
          <button className="secondary-button" type="button" onClick={() => trade('sell')} disabled={heldShares === 0}>卖出 {shares} 股</button>
        </div>
      </section>

      <section className="pixel-panel info-panel">
        <div className="section-title">
          <span>公司基本面</span>
          <b>{stock.realName}</b>
        </div>
        <p className="info-text">{stock.intro}</p>
      </section>

      <section className="pixel-panel info-panel">
        <div className="section-title">
          <span>盈利能力</span>
        </div>
        <p className="info-text">{stock.profit}</p>
      </section>

      <section className="pixel-panel info-panel">
        <div className="section-title">
          <span>估值逻辑</span>
        </div>
        <p className="info-text">{stock.valuation}</p>
      </section>

      <section className="pixel-panel info-panel">
        <div className="section-title">
          <span>相关动态</span>
          <b>{stock.events.length} 条</b>
        </div>
        <div className="news-page-list">
          {stock.events.map((event, index) => (
            <article className={`news-card detail-news ${newsTones[index % newsTones.length]}`} key={event}>
              <div>
                <span className={`tag ${newsTones[index % newsTones.length]}`}>动态 · {stock.realName}</span>
              </div>
              <p>关注「{event}」对 {stock.name} 的影响，可能成为本局的价格触发点。</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function WalletFloat({ portfolio }: { portfolio: Portfolio }) {
  const [open, setOpen] = useState(false)

  const positions = useMemo(
    () =>
      Object.entries(portfolio.holdings)
        .filter(([, h]) => h.shares > 0)
        .map(([code, h]) => {
          const stock = stocks.find((s) => s.code === code)
          const value = stock ? h.shares * stock.price : 0
          const pnl = value - h.cost
          return { code, name: stock?.name ?? code, shares: h.shares, value, pnl }
        })
        .sort((a, b) => b.value - a.value),
    [portfolio.holdings],
  )

  const positionValue = positions.reduce((sum, p) => sum + p.value, 0)
  const total = portfolio.cash + positionValue
  const totalPnl = total - INITIAL_CASH
  const totalPct = (totalPnl / INITIAL_CASH) * 100

  return (
    <>
      <button className="wallet-float" onClick={() => setOpen((value) => !value)} type="button">
        钱包
      </button>
      {open && (
        <section className="wallet-popover pixel-panel">
          <div className="section-title">
            <span>我的钱包</span>
            <b className={totalPnl >= 0 ? 'rise' : 'fall'}>
              {totalPnl >= 0 ? '+' : ''}{totalPct.toFixed(1)}%
            </b>
          </div>
          <div className="wallet-grid">
            <span>总资产</span>
            <strong>{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            <span>现金</span>
            <strong>{portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            <span>持仓市值</span>
            <strong>{positionValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
            <span>累计盈亏</span>
            <strong className={totalPnl >= 0 ? 'rise' : 'fall'}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </strong>
            <span>最近交易</span>
            <strong>
              {portfolio.lastTrade
                ? `${portfolio.lastTrade.type === 'buy' ? '买入' : '卖出'} ${portfolio.lastTrade.name} ${portfolio.lastTrade.shares}股`
                : '暂无'}
            </strong>
          </div>

          <div className="wallet-positions">
            <div className="wallet-positions-head">当前持仓</div>
            {positions.length === 0 ? (
              <p className="wallet-empty">尚无持仓，去选股买入吧。</p>
            ) : (
              positions.map((p) => (
                <div className="wallet-pos-row" key={p.code}>
                  <span className="wallet-pos-name">
                    <b>{p.name}</b>
                    <small>{p.shares} 股</small>
                  </span>
                  <span className="wallet-pos-val">
                    <b>{p.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>
                    <small className={p.pnl >= 0 ? 'rise' : 'fall'}>
                      {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(0)}
                    </small>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </>
  )
}

function FinalePage({ back }: { back: () => void }) {
  const podium = [...players].sort((a, b) => b.profit - a.profit).slice(0, 3)
  const [shared, setShared] = useState(false)

  const generateCard = async () => {
    const summary = '《我不是股神》本局卧底：王五。股神：李四 +12.8%。'
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary)
      }
    } catch {
      // 忽略剪贴板异常
    }
    setShared(true)
    window.setTimeout(() => setShared(false), 2000)
  }

  return (
    <main className="screen-body immersive-body page-view">
      <section className="pixel-panel page-head">
        <button className="text-link" onClick={back} type="button">返回小酒馆</button>
        <h2>终局审判</h2>
      </section>
      <section className="pixel-panel finale-hero">
        <span className="eyebrow">卧底惨胜</span>
        <p>卧底被投出，但黑金太高。识破了，也亏麻了。</p>
      </section>
      <section className="pixel-panel">
        <div className="section-title">
          <span>收益率排行</span>
          <b>领奖台</b>
        </div>
        <div className="podium">
          {[podium[1], podium[0], podium[2]].map((player, index) => (
            <div className={`podium-place place-${index}`} key={player.id}>
              <div className={`avatar ${player.undercover ? 'undercover' : ''}`}>{player.avatar}</div>
              <strong>{player.name}</strong>
              <span>{player.profit}%</span>
            </div>
          ))}
        </div>
      </section>
      <section className="pixel-panel share-card">
        <h3>本局卧底：王五</h3>
        <p>经典名场面：赵六第 3 天满仓追高，成功把自己送上韭菜榜。</p>
        <button className="primary-button full" type="button" onClick={generateCard}>{shared ? '已复制分享文案' : '生成分享卡'}</button>
      </section>
    </main>
  )
}

function Mine() {
  return (
    <main className="screen-body">
      <section className="pixel-panel profile-panel">
        <div className="avatar hero-avatar">ME</div>
        <div>
          <span className="eyebrow">我的</span>
          <h2>嘴硬大师 Lv.6</h2>
          <p>18 局战绩，11 次找出卧底。</p>
        </div>
      </section>
      <section className="pixel-panel">
        <div className="section-title">
          <span>好友排行</span>
          <b>本周</b>
        </div>
        {[...players].sort((a, b) => b.profit - a.profit).map((player, index) => (
          <div className="rank-row" key={player.id}>
            <span>#{index + 1}</span>
            <b>{player.name}</b>
            <strong className={player.profit > 0 ? 'rise' : 'fall'}>{player.profit}%</strong>
          </div>
        ))}
      </section>
      <section className="pixel-panel history-card">
        <strong>最近战绩</strong>
        <p>普通投资人胜利。股神：李四；韭菜王：赵六。</p>
      </section>
    </main>
  )
}

function Learn() {
  return (
    <main className="screen-body">
      <section className="pixel-panel learn-panel">
        <span className="eyebrow">学习</span>
        <h2>理财录播课</h2>
        <p>看懂 K 线、仓位和消息可信度，少做下一根韭菜。</p>
      </section>
      {['识别市场传闻', '仓位不是勇气值', '卧底不能控制涨跌', '战报里的线索'].map((title, index) => (
        <article className="lesson-card pixel-panel" key={title}>
          <span>0{index + 1}</span>
          <div>
            <strong>{title}</strong>
            <p>{index === 0 ? '看来源、看时点、看谁提前动手。' : '3 分钟短课。'}</p>
          </div>
        </article>
      ))}
    </main>
  )
}

function AgentDock() {
  const [open, setOpen] = useState(false)
  const [agent, setAgent] = useState<AgentKey>('feng')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<{ id: number; role: 'user' | 'agent'; text: string }[]>([])
  const current = agents[agent]

  const sendMessage = () => {
    const text = draft.trim()
    if (!text) return
    const base = Date.now()
    setMessages((prev) => [
      ...prev,
      { id: base, role: 'user', text },
      { id: base + 1, role: 'agent', text: `${current.name}：${current.line}` },
    ])
    setDraft('')
  }

  return (
    <>
      <button className="agent-float" onClick={() => setOpen(true)} type="button" aria-label="打开智囊团">
        <span className="agent-pixel-face">AI</span>
        <b>智囊团</b>
      </button>

      {open && (
        <div className="agent-chat" role="dialog" aria-label="智囊团聊天">
          <div className="agent-tabs">
            {(Object.keys(agents) as AgentKey[]).map((key) => (
              <button className={agent === key ? 'active' : ''} key={key} onClick={() => setAgent(key)} type="button">
                {agents[key].name}
              </button>
            ))}
          </div>

          <div className="agent-head">
            <div className="avatar agent-avatar">{current.avatar}</div>
            <div>
              <strong>{current.name}</strong>
              <p>{current.tip}</p>
            </div>
            <button className="agent-close" onClick={() => setOpen(false)} type="button" aria-label="关闭">×</button>
          </div>

          <div className="chat-lines">
            <p className="agent-bubble">{current.line}</p>
            <p className="user-bubble">这条市场传闻能信吗？</p>
            <p className="agent-bubble">先别急着信。看谁在消息出现前动过手，再看谁最想让大家追进去。</p>
            {messages.map((message) => (
              <p className={message.role === 'user' ? 'user-bubble' : 'agent-bubble'} key={message.id}>{message.text}</p>
            ))}
          </div>

          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault()
              sendMessage()
            }}
          >
            <input
              aria-label="输入问题"
              placeholder="问智囊团一句..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit">发送</button>
          </form>
        </div>
      )}
    </>
  )
}

function App() {
  const [mainView, setMainView] = useState<MainView>('room')
  const [roomView, setRoomView] = useState<RoomView>('lobby')
  const [modalView, setModalView] = useState<ModalView>(null)
  const [selectedStock, setSelectedStock] = useState(stocks[0])
  const [secondsLeft, setSecondsLeft] = useState(5 * 60)
  const [portfolio, setPortfolio] = useState<Portfolio>({
    cash: INITIAL_CASH,
    holdings: {},
    lastTrade: null,
  })

  const handleTrade = (stock: Stock, type: 'buy' | 'sell', shares: number): string => {
    let message = ''
    setPortfolio((prev) => {
      const held = prev.holdings[stock.code] ?? { shares: 0, cost: 0 }
      if (type === 'buy') {
        const amount = shares * stock.price
        if (amount > prev.cash) {
          message = `现金不足，最多可买 ${Math.floor(prev.cash / stock.price)} 股`
          return prev
        }
        message = `已买入 ${stock.name} ${shares} 股`
        return {
          cash: prev.cash - amount,
          holdings: {
            ...prev.holdings,
            [stock.code]: { shares: held.shares + shares, cost: held.cost + amount },
          },
          lastTrade: { type, name: stock.name, code: stock.code, shares, amount },
        }
      }
      // sell
      if (shares > held.shares) {
        message = `持仓不足，当前仅持有 ${held.shares} 股`
        return prev
      }
      const amount = shares * stock.price
      const avg = held.shares > 0 ? held.cost / held.shares : 0
      const remainShares = held.shares - shares
      const newHoldings = { ...prev.holdings }
      if (remainShares > 0) {
        newHoldings[stock.code] = { shares: remainShares, cost: avg * remainShares }
      } else {
        delete newHoldings[stock.code]
      }
      message = `已卖出 ${stock.name} ${shares} 股`
      return {
        cash: prev.cash + amount,
        holdings: newHoldings,
        lastTrade: { type, name: stock.name, code: stock.code, shares, amount },
      }
    })
    return message
  }

  const inRoom = mainView === 'room' && roomView !== 'lobby'
  const closeModal = () => setModalView(null)
  const timerText = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`

  useEffect(() => {
    if (!inRoom) return

    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 5 * 60))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [inRoom])

  return (
    <div className="app-shell">
      <div className={`phone-frame ${inRoom ? 'immersive' : ''}`}>
        <div className="crt-layer" />
        {inRoom && modalView !== 'finale' && (
          <div className="room-top">
            <nav className="room-subnav" aria-label="局内导航">
              <button
                className={roomView === 'tavern' && !modalView ? 'active' : ''}
                onClick={() => {
                  setRoomView('tavern')
                  setModalView(null)
                }}
                type="button"
              >
                小酒馆
              </button>
              <button
                className={roomView === 'market' ? 'active' : ''}
                onClick={() => {
                  setRoomView('market')
                  setModalView('stocks')
                }}
                type="button"
              >
                交易所
              </button>
            </nav>
            {roomView === 'market' && (
              <div className="stopwatch" aria-label={`交易倒计时 ${timerText}`}>
                <span>ROUND 04</span>
                <strong>{timerText}</strong>
                <small>交易倒计时</small>
              </div>
            )}
          </div>
        )}

        {mainView === 'room' && roomView === 'lobby' && <RoomLobby startGame={() => setRoomView('tavern')} />}
        {inRoom && !modalView && roomView === 'tavern' && <Tavern openModal={setModalView} />}
        {inRoom && roomView === 'market' && (modalView === null || modalView === 'stocks') && (
          <StocksPage
            pickStock={(stock) => {
              setSelectedStock(stock)
              setModalView('stockDetail')
            }}
          />
        )}
        {inRoom && roomView === 'market' && modalView === 'news' && <NewsPage />}
        {inRoom && modalView === 'stockDetail' && (
          <StockDetail
            stock={selectedStock}
            back={() => setModalView('stocks')}
            portfolio={portfolio}
            onTrade={handleTrade}
          />
        )}
        {inRoom && modalView === 'finale' && <FinalePage back={closeModal} />}
        {inRoom && roomView === 'market' && modalView !== 'finale' && (
          <>
            <WalletFloat portfolio={portfolio} />
            <nav className="market-bottom-nav" aria-label="交易所板块">
              <button className={modalView === 'news' ? 'active' : ''} onClick={() => setModalView('news')} type="button">新闻</button>
              <button className={modalView === 'stocks' || modalView === 'stockDetail' || modalView === null ? 'active' : ''} onClick={() => setModalView('stocks')} type="button">选股</button>
            </nav>
          </>
        )}

        {mainView === 'mine' && <Mine />}
        {mainView === 'learn' && <Learn />}

        {!inRoom && (
          <nav className="bottom-nav" aria-label="主导航">
            {(['learn', 'room', 'mine'] as MainView[]).map((key) => (
              <button className={mainView === key ? 'active' : ''} key={key} onClick={() => setMainView(key)} type="button">
                <span>{key === 'learn' ? '学习' : key === 'room' ? '开启房间' : '我的'}</span>
              </button>
            ))}
          </nav>
        )}
        <AgentDock />
      </div>
    </div>
  )
}

export default App
