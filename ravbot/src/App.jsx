import './App.css'

function App() {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>RavBot</h1>
        <p>Your Wealth Execution AI</p>
      </header>

      <main className="task-panel">
        <h2>Today’s Wealth Tasks</h2>
        <ul>
          <li>✅ Review your net worth</li>
          <li>📈 Run a 1-click DCA into BTC/ETH</li>
          <li>📤 Pay down $20 of high-interest debt</li>
        </ul>
      </main>

      <footer className="dashboard-footer">
        <p>app.ravgrowth.com | Powered by RavGrowth</p>
      </footer>
    </div>
  )
}

export default App
