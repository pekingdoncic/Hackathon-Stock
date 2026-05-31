import { useEffect, useMemo, useState } from 'react'
import './App.css'

type MainView = 'learn' | 'room' | 'mine'
type RoomView = 'lobby' | 'tavern' | 'market'
type ModalView = 'news' | 'stocks' | 'stockDetail' | 'finale' | null
type AgentKey = 'buffett' | 'duan' | 'feng'

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

type Stock = {
  code: string
  name: string
  price: number
  change: number
  heat: number
}

const players: Player[] = [
  { id: 'p1', name: '张三', avatar: 'ZS', profit: -8.6, suspicion: 32, speech: '我没上头，我只是提前相信。', move: '追入量子科技，尾盘回撤 6.2%。', trend: [42, 46, 38, 31, 29] },
  { id: 'p2', name: '李四', avatar: 'LS', profit: 12.8, suspicion: 18, speech: '先别急着喊股神，收盘再说。', move: '减仓新能源车，避开午后跳水。', trend: [31, 36, 39, 48, 55] },
  { id: 'p3', name: '王五', avatar: 'WW', undercover: true, profit: 2.4, suspicion: 68, speech: '市场传闻嘛，听听就好。', move: '利好出现前建仓，追入后减仓。', trend: [34, 35, 34, 36, 37] },
  { id: 'p4', name: '赵六', avatar: 'ZL', profit: -14.2, suspicion: 25, speech: '这把我先把节目效果拉满。', move: '连续两日跟风，账户曲线跳水。', trend: [45, 39, 31, 25, 21] },
]

const stocks: Stock[] = [
  { code: 'QTKJ', name: '量子科技', price: 31.42, change: 7.8, heat: 92 },
  { code: 'AIXP', name: 'AI 芯片', price: 18.76, change: -3.6, heat: 74 },
  { code: 'XNYC', name: '新能源车', price: 52.1, change: 2.9, heat: 61 },
  { code: 'YYYL', name: '云游戏', price: 12.48, change: -1.4, heat: 46 },
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

function RoomLobby({ startGame }: { startGame: () => void }) {
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
          <button className="secondary-button" type="button">邀请好友</button>
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
          <button className="voice-button" type="button">按住发言</button>
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
          <button className="primary-button" type="button">投他</button>
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

function StocksPage({ pickStock }: { pickStock: (stock: Stock) => void }) {
  return (
    <main className="screen-body immersive-body page-view">
      <section className="pixel-panel page-head">
        <h2>选股板块</h2>
        <p>点击股票查看 K 线和买卖操作。</p>
      </section>
      <section className="pixel-panel stock-page-list">
        {stocks.map((stock) => (
          <button className="stock-row" key={stock.code} onClick={() => pickStock(stock)} type="button">
            <span>
              <b>{stock.name}</b>
              <small>{stock.code}</small>
            </span>
            <strong className={stock.change > 0 ? 'rise' : 'fall'}>
              {stock.change > 0 ? '+' : ''}{stock.change}%
            </strong>
          </button>
        ))}
      </section>
    </main>
  )
}

function StockDetail({ stock, back }: { stock: Stock; back: () => void }) {
  return (
    <main className="screen-body immersive-body page-view">
      <section className="pixel-panel page-head">
        <button className="text-link" onClick={back} type="button">返回选股</button>
        <h2>{stock.name}</h2>
      </section>
      <section className="pixel-panel detail-panel">
        <div className="section-title">
          <span>K 线</span>
          <b>{stock.price.toFixed(2)}</b>
        </div>
        <div className="candles tall-candles">
          {Array.from({ length: 22 }).map((_, index) => (
            <i key={index} style={{ height: `${24 + ((index * 11 + stock.heat) % 66)}px` }} />
          ))}
        </div>
        <div className="trade-actions">
          <button className="primary-button" type="button">买入</button>
          <button className="secondary-button" type="button">卖出</button>
        </div>
      </section>
    </main>
  )
}

function WalletFloat() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="wallet-float" onClick={() => setOpen((value) => !value)} type="button">
        钱包
      </button>
      {open && (
        <section className="wallet-popover pixel-panel">
          <div className="section-title">
            <span>我的钱包</span>
            <b>记录</b>
          </div>
        <div className="wallet-grid">
          <span>持仓</span>
          <strong>QTKJ 40%</strong>
          <span>现金</span>
          <strong>48,200</strong>
          <span>最近交易</span>
          <strong>卖出 AIXP</strong>
          <span>今日收益</span>
          <strong className="rise">+2.8%</strong>
        </div>
        </section>
      )}
    </>
  )
}

function FinalePage({ back }: { back: () => void }) {
  const podium = [...players].sort((a, b) => b.profit - a.profit).slice(0, 3)

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
        <button className="primary-button full" type="button">生成分享卡</button>
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
  const current = agents[agent]

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
          </div>

          <form className="chat-input">
            <input aria-label="输入问题" placeholder="问智囊团一句..." />
            <button type="button">发送</button>
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
              <button className={roomView === 'tavern' ? 'active' : ''} onClick={() => setRoomView('tavern')} type="button">小酒馆</button>
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
        {inRoom && modalView === 'stocks' && (
          <StocksPage
            pickStock={(stock) => {
              setSelectedStock(stock)
              setModalView('stockDetail')
            }}
          />
        )}
        {inRoom && modalView === 'stockDetail' && <StockDetail stock={selectedStock} back={() => setModalView('stocks')} />}
        {inRoom && modalView === 'finale' && <FinalePage back={closeModal} />}
        {inRoom && roomView === 'market' && modalView !== 'finale' && (
          <>
            <WalletFloat />
            <nav className="market-bottom-nav" aria-label="交易所板块">
              <button className={modalView === 'news' ? 'active' : ''} onClick={() => setModalView('news')} type="button">新闻</button>
              <button className={modalView !== 'news' ? 'active' : ''} onClick={() => setModalView('stocks')} type="button">选股</button>
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
