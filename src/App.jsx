import { useState, useEffect } from 'react'
import { LayoutDashboard, Users, Settings, LogOut, Search, MoreVertical, Shield, UserPlus, Mail, Key, Bell, ClipboardList, TrendingUp, Edit2, Trash2, Eye, Plus, X, ListCheck, Trophy, Check, UserMinus } from 'lucide-react'
import pb from './lib/pocketbase'

// Specific Admin Check for safety
const ADMIN_EMAIL = 'acadease_admin@cca.edu.ph'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeAdminsCount, setActiveAdminsCount] = useState(0)

  // Standard PocketBase Admin check
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid && pb.authStore.isSuperuser)
  const [authData, setAuthData] = useState({ email: '', password: '' })

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isDetailView, setIsDetailView] = useState(false)

  // User Form State
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: ''
  })

  // Student Details State
  const [studentStats, setStudentStats] = useState(null)
  const [studentTasks, setStudentTasks] = useState([])

  useEffect(() => {
    if (isAuthenticated && activeTab === 'users') {
      fetchUsers()
    }
  }, [activeTab, isAuthenticated])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // USE pb.admins because acadease_admin@cca.edu.ph is a PocketBase Admin/Superuser
      const auth = await pb.admins.authWithPassword(authData.email, authData.password)

      if (auth.record.email !== ADMIN_EMAIL) {
        pb.authStore.clear()
        setError('Access Denied: Only the Master Admin account can access this panel.')
      } else {
        setIsAuthenticated(true)
      }
    } catch (err) {
      setError('Invalid admin credentials. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSystemAlerts = () => {
    alert("SYSTEM STATUS:\n- PocketBase: Online (https://acadease.fly.dev)\n- Database Health: Optimal\n- Auth Service: Superuser Authenticated\n- Storage Service: Connected\n\nNo pending critical alerts.")
  }

  const handleLogout = () => {
    pb.authStore.clear()
    setIsAuthenticated(false)
    setActiveTab('dashboard')
  }

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch users, stats, and admins in parallel
      const [records, stats, admins] = await Promise.all([
        pb.collection('users').getFullList({ sort: '-created' }),
        pb.collection('user_stats').getFullList(),
        pb.admins.getList(1, 100)
      ])

      // Enrich user records with stats
      const enriched = records.map(user => {
        const s = stats.find(stat => stat.user === user.id)
        return {
          ...user,
          xp: s?.total_points || 0,
          tasks: s?.tasks_completed || 0
        }
      })

      setUsers(enriched)
      setActiveAdminsCount(admins.totalItems || 1)
    } catch (err) {
      setError('Failed to fetch data. Check console for details.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user =>
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    user.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddUser = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await pb.collection('users').create({
        ...userForm,
        passwordConfirm: userForm.password
      })
      setIsModalOpen(false)
      setUserForm({ name: '', email: '', password: '', passwordConfirm: '' })
      fetchUsers()
    } catch (err) {
      alert('Error creating user: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await pb.collection('users').update(selectedUser.id, {
        name: userForm.name,
        email: userForm.email
      })
      setIsModalOpen(false)
      fetchUsers()
    } catch (err) {
      alert('Error updating user: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Delete this student and all their data (Tasks & XP)? This action is permanent.')) {
      setLoading(true)
      try {
        // First delete their stats and tasks to avoid "record in use" errors
        const [stats, tasks] = await Promise.all([
           pb.collection('user_stats').getFullList({ filter: `user = "${userId}"` }),
           pb.collection('tasks').getFullList({ filter: `user = "${userId}"` })
        ]);

        await Promise.all([
           ...stats.map(s => pb.collection('user_stats').delete(s.id)),
           ...tasks.map(t => pb.collection('tasks').delete(t.id))
        ]);

        // Now delete the user
        await pb.collection('users').delete(userId)
        fetchUsers()
      } catch (err) {
        alert('Error during cleanup: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleApproveUser = async (user) => {
    setLoading(true)
    try {
      await pb.collection('users').update(user.id, {
        needs_approval: false,
        banned: false // Ensure unbanned if approving
      })
      fetchUsers()
      alert(`${user.name || 'User'} has been approved successfully!`)
    } catch (err) {
      alert('Error approving user: ' + err.message)
    } finally {
      setLoading(true)
    }
  }

  const handleToggleBanUser = async (user) => {
    const isBanning = !user.banned;
    if (isBanning && !window.confirm(`Are you sure you want to BAN ${user.name || 'this user'}? They will be blocked from the app.`)) {
      return;
    }
    
    setLoading(true)
    try {
      await pb.collection('users').update(user.id, {
        banned: isBanning
      })
      fetchUsers()
      alert(`${user.name || 'User'} has been ${isBanning ? 'BANNED' : 'UNBANNED'} successfully!`)
    } catch (err) {
      alert('Error toggling ban: ' + err.message)
    } finally {
      setLoading(true)
    }
  }

  const viewUserDetails = async (user) => {
    setSelectedUser(user)
    setIsDetailView(true)
    setLoading(true)
    try {
      const statsList = await pb.collection('user_stats').getFullList({
        filter: `user = "${user.id}"`,
      })
      setStudentStats(statsList.length > 0 ? statsList[0] : null)

      const tasksList = await pb.collection('tasks').getFullList({
        filter: `user = "${user.id}"`,
        sort: '-created',
      })
      setStudentTasks(tasksList)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setIsEditMode(false)
    setUserForm({ name: '', email: '', password: '', passwordConfirm: '' })
    setIsModalOpen(true)
  }

  const openEditModal = (user) => {
    setIsEditMode(true)
    setSelectedUser(user)
    setUserForm({ name: user.name, email: user.email, password: '', passwordConfirm: '' })
    setIsModalOpen(true)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] text-slate-800">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-60"></div>

        <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(3,56,103,0.1)] w-full max-w-md border border-white z-10">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl">
              <Shield size={40} className="drop-shadow-lg" />
            </div>
            <h2 className="text-3xl font-black text-[#033867]">AcadEase Admin</h2>
            <p className="text-slate-400 font-medium mt-1">Official Master Administrator Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Admin Email</label>
              <input
                type="email"
                value={authData.email}
                onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-medium focus:bg-white"
                placeholder="acadease_admin@cca.edu.ph"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
              <input
                type="password"
                value={authData.password}
                onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-medium focus:bg-white"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm font-bold bg-red-50 p-4 rounded-2xl border border-red-100">
                {error}
              </div>
            )}

            <button disabled={loading} className="w-full py-4 bg-[#033867] text-white rounded-2xl font-black text-lg hover:bg-blue-900 transition-all shadow-xl shadow-blue-900/10 transform hover:-translate-y-1 active:scale-95">
              {loading ? 'Verifying Admin...' : 'Sign In To Panel'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      <aside className="w-72 bg-[#033867] text-white flex flex-col fixed h-full shadow-2xl z-20">
        <div className="p-8 pb-10 flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-900 shadow-xl">
            <Shield size={24} />
          </div>
          <h1 className="text-xl font-black tracking-tight">AcadEase Admin</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-4 mb-4">Core Management</p>
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold ${activeTab === 'dashboard' ? 'bg-white text-blue-900 shadow-lg' : 'text-blue-100/60 hover:text-white hover:bg-white/5'}`}>
            <LayoutDashboard size={22} /> Dashboard
          </button>
          <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold ${activeTab === 'users' ? 'bg-white text-blue-900 shadow-lg' : 'text-blue-100/60 hover:text-white hover:bg-white/5'}`}>
            <Users size={22} /> Student Records
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold ${activeTab === 'settings' ? 'bg-white text-blue-900 shadow-lg' : 'text-blue-100/60 hover:text-white hover:bg-white/5'}`}>
            <Settings size={22} /> System Status
          </button>
        </nav>

        <div className="p-6">
          <div className="bg-white/10 rounded-3xl p-4 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-400 to-blue-200 rounded-full flex items-center justify-center text-blue-900 font-black shadow-lg">A</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate">{pb.authStore.record?.email || 'Master Admin'}</p>
                <p className="text-[10px] text-blue-300 truncate font-bold uppercase tracking-widest">CCA Superuser</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 text-red-100 hover:bg-red-50 hover:text-white rounded-2xl transition-all text-xs font-black uppercase tracking-widest">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-72 min-h-screen">
        <header className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md px-10 py-6 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-[#033867]">
              {activeTab === 'dashboard' ? 'Control Panel' : activeTab === 'users' ? 'Users' : 'Settings'}
            </h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              System Online: Superuser Access
            </p>
          </div>
          <div className="flex items-center gap-4">
            {activeTab === 'users' && (
              <button onClick={openAddModal} className="flex items-center gap-2 px-6 py-2.5 bg-[#033867] text-white rounded-xl font-bold hover:bg-blue-900 transition-all shadow-xl active:scale-95">
                <Plus size={20} /> Add Student
              </button>
            )}
          </div>
        </header>

        <div className="p-10">
          {activeTab === 'dashboard' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Total Students", value: users.length, icon: <Users />, color: "text-blue-600", light: "bg-blue-50", action: () => setActiveTab('users') },
                  { label: "Pending Approvals", value: users.filter(u => u.needs_approval).length, icon: <UserPlus />, color: "text-red-600", light: "bg-red-50", action: () => { setActiveTab('users'); } },
                  { label: "Active Admins", value: activeAdminsCount, icon: <Shield />, color: "text-green-600", light: "bg-green-50", action: () => setActiveTab('settings') },
                  { label: "Server Load", value: "Low", icon: <TrendingUp />, color: "text-orange-600", light: "bg-orange-50", action: () => fetchUsers() },
                ].map((stat, i) => (
                  <button key={i} onClick={stat.action} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-all text-left group active:scale-95">
                    <div className={`w-14 h-14 ${stat.light} ${stat.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>{stat.icon}</div>
                    <h3 className="text-slate-500 font-bold text-sm">{stat.label}</h3>
                    <p className="text-2xl font-black text-[#033867] mt-1">{stat.value}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
                  <h3 className="text-xl font-black text-[#033867] mb-8 flex items-center gap-3">
                    <Trophy className="text-yellow-500" /> Top Performing Students
                  </h3>
                  <div className="space-y-6">
                    {[...users].sort((a,b) => (b.xp || 0) - (a.xp || 0)).slice(0, 5).map((user, i) => (
                      <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-3xl border border-slate-50 hover:bg-white hover:border-blue-200 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${i === 0 ? 'bg-yellow-100 text-yellow-600' : 'bg-white text-slate-400 border border-slate-100'}`}>
                            {i + 1}
                          </div>
                          <div>
                            <p className="font-black text-[#033867]">{user.name || 'Anonymous'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.tasks || 0} Missions Completed</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-blue-600">{user.xp || 0} XP</p>
                        </div>
                      </div>
                    ))}
                    {users.length === 0 && (
                      <div className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-xs">No user data available</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col">
                  <h3 className="text-xl font-black text-[#033867] mb-8 flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      <UserPlus className="text-red-500" /> Pending Approvals
                    </span>
                    <span className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-full font-black uppercase">{users.filter(u => u.needs_approval).length} Urgent</span>
                  </h3>
                  <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-2">
                    {users.filter(u => u.needs_approval).map((user) => (
                      <div key={user.id} className="p-5 bg-red-50/30 border border-red-100 rounded-3xl flex items-center justify-between group hover:bg-white hover:border-red-400 transition-all shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-[#033867] shadow-sm border border-red-50">
                            {user.name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <h4 className="font-black text-[#033867]">{user.name || 'New Registration'}</h4>
                            <p className="text-[10px] font-bold text-slate-400 truncate w-32 uppercase tracking-widest">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleDeleteUser(user.id)} className="p-3 text-red-600 bg-white hover:bg-red-50 rounded-xl transition-all border border-red-100 shadow-sm" title="Reject"><X size={18} /></button>
                          <button onClick={() => handleApproveUser(user)} className="p-3 text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md shadow-green-900/10" title="Approve"><Check size={18} /></button>
                        </div>
                      </div>
                    ))}
                    {users.filter(u => u.needs_approval).length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-40">
                        <ListCheck size={48} className="mb-4 text-slate-300" />
                        <p className="font-black text-slate-400 uppercase tracking-widest text-xs">All caught up! No pending accounts.</p>
                      </div>
                    )}
                  </div>
                  {users.filter(u => u.needs_approval).length > 0 && (
                    <button onClick={() => setActiveTab('users')} className="mt-6 w-full py-4 text-blue-600 font-black text-xs uppercase tracking-widest border-t border-slate-50 hover:text-blue-800 transition-colors">View All Records</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                <div className="relative w-80">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <Search size={20} />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all"
                    placeholder="Find user by name or ID..."
                  />
                </div>
                <button onClick={fetchUsers} className="p-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:text-blue-600 transition-all hover:bg-blue-50 shadow-sm active:scale-95">
                  <TrendingUp size={20} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                      <th className="px-10 py-6">ID / Name</th>
                      <th className="px-10 py-6">Email Address</th>
                      <th className="px-10 py-6">Status</th>
                      <th className="px-10 py-6">Performance</th>
                      <th className="px-10 py-6 text-right">CRUD Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading && !users.length ? (
                      <tr><td colSpan="5" className="py-20 text-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="font-black text-slate-400 uppercase tracking-widest text-xs">Accessing Records...</p></td></tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="group hover:bg-blue-50/30 transition-colors">
                          <td className="px-10 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white border border-slate-100 text-[#033867] rounded-2xl flex items-center justify-center font-black group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                {user.name?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <div className="font-black text-[#033867]">{user.name || 'Anonymous Student'}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-6 font-bold text-slate-600">{user.email}</td>
                          <td className="px-10 py-6 text-slate-400 text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              {user.banned ? (
                                  <span className="px-3 py-1 bg-black text-white rounded-full text-[10px] font-black uppercase text-center">Banned</span>
                              ) : user.needs_approval ? (
                                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase text-center">Pending</span>
                              ) : (
                                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase text-center">Approved</span>
                              )}
                            </div>
                          </td>
                          <td className="px-10 py-6">
                            <div className="flex flex-col">
                              <span className="font-black text-blue-700 text-sm">{user.xp || 0} XP</span>
                              <span className="text-[10px] font-bold text-slate-400">{user.tasks || 0} Missions</span>
                            </div>
                          </td>
                          <td className="px-10 py-6 text-slate-400 text-sm font-medium">{new Date(user.created).toLocaleDateString()}</td>
                           <td className="px-10 py-6 text-right">
                             <div className="flex items-center justify-end gap-2">
                               {user.needs_approval && (
                                  <button onClick={() => handleApproveUser(user)} className="flex items-center gap-2 px-4 py-2 text-green-700 bg-green-50 hover:bg-green-600 hover:text-white rounded-xl transition-all border border-green-100 font-bold text-xs" title="Approve Student">
                                    <Check size={16} /> Approve
                                  </button>
                               )}
                               <button onClick={() => handleToggleBanUser(user)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-xs border ${user.banned ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'}`} title={user.banned ? "Unban User" : "Ban User"}>
                                 <Shield size={16} /> {user.banned ? 'Unban' : 'Ban'}
                               </button>
                               <button onClick={() => viewUserDetails(user)} className="p-2.5 text-blue-600 bg-blue-50 hover:bg-[#033867] hover:text-white rounded-xl transition-all border border-blue-100" title="View Progress">
                                 <Eye size={18} />
                               </button>
                               <button onClick={() => openEditModal(user)} className="p-2.5 text-slate-600 bg-slate-50 hover:bg-slate-800 hover:text-white rounded-xl transition-all border border-slate-100" title="Edit Profile">
                                 <Edit2 size={18} />
                               </button>
                               <button onClick={() => handleDeleteUser(user.id)} className="p-2.5 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-red-100" title="Delete Account">
                                 <Trash2 size={18} />
                               </button>
                             </div>
                           </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 max-w-2xl mx-auto">
              <h2 className="text-2xl font-black text-[#033867] mb-8 flex items-center gap-3">
                <Settings className="text-blue-600" /> System Configuration
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div>
                    <p className="text-sm font-black text-[#033867]">Backend Server</p>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">https://acadease.fly.dev</p>
                  </div>
                  <div className="px-4 py-2 bg-green-100 text-green-600 rounded-xl text-xs font-black">STABLE</div>
                </div>

                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div>
                    <p className="text-sm font-black text-[#033867]">Superuser Session</p>
                    <p className="text-xs text-slate-400 font-bold tracking-widest">{pb.authStore.record?.email}</p>
                  </div>
                  <button onClick={() => fetchUsers()} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black active:scale-95 transition-all">CHECK</button>
                </div>

                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div>
                    <p className="text-sm font-black text-[#033867]">Maintenance Mode</p>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Global Access Lock</p>
                  </div>
                  <div className="w-12 h-6 bg-slate-200 rounded-full relative p-1 cursor-not-allowed">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-center">Version 1.0.4-stable • Academic Edition</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* CRUD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative animate-in zoom-in duration-200">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900"><X size={24} /></button>
            <h2 className="text-3xl font-black mb-2 text-[#033867]">{isEditMode ? 'Edit Profile' : 'New Enrollment'}</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-10">Admin Authority Level: Write</p>

            <form onSubmit={isEditMode ? handleUpdateUser : handleAddUser} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Full Identity Name</label>
                <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold focus:bg-white outline-none" placeholder="Enter name" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Digital Mail Address</label>
                <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold focus:bg-white outline-none" placeholder="student@cca.edu.ph" required />
              </div>
              {!isEditMode && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Temporary Password</label>
                  <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 font-bold focus:bg-white outline-none" placeholder="Strong password" required />
                </div>
              )}
              <button disabled={loading} className="w-full py-5 bg-[#033867] text-white rounded-2xl font-black text-lg hover:bg-blue-900 shadow-xl mt-6 active:scale-95 transition-all">
                {loading ? 'Committing to Cloud...' : isEditMode ? 'Update Database' : 'Enroll Student'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {isDetailView && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex items-end justify-end p-0">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl p-10 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-blue-50 text-[#033867] rounded-3xl flex items-center justify-center font-black text-3xl shadow-inner">{selectedUser.name?.charAt(0)}</div>
                <div>
                  <h2 className="text-3xl font-black text-[#033867]">{selectedUser.name || 'Student View'}</h2>
                  <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-1">Global Database ID: {selectedUser.id}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailView(false)} className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-10 pr-2 pb-10">
              <section>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Trophy size={16} /> Performance Summary</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-[#033867] p-8 rounded-[2.5rem] text-white shadow-xl">
                    <p className="text-blue-300 font-black uppercase text-[10px] tracking-widest mb-2">Student Points</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black tracking-tighter">{studentStats?.total_points || 0}</span>
                      <span className="font-black text-blue-400">XP</span>
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-2">Completions</p>
                    <p className="text-4xl font-black text-[#033867]">{studentStats?.tasks_completed || 0}</p>
                    <div className="mt-4 inline-block bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                      Streak: {studentStats?.current_streak || 0} Days
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><ClipboardList size={16} /> Individual Missions</h3>
                <div className="space-y-4">
                  {loading ? (
                    <div className="py-20 text-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
                  ) : studentTasks.length > 0 ? (
                    studentTasks.map((task) => (
                      <div key={task.id} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between group hover:bg-white hover:border-blue-200 hover:shadow-lg transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${task.completed ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                            {task.completed ? '✓' : '!'}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800 group-hover:text-blue-900">{task.title}</h4>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{task.priority} Priority</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] font-black text-slate-400 group-hover:text-slate-700 uppercase">{new Date(task.created).toLocaleDateString()}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 px-6 border-2 border-dashed border-slate-100 rounded-3xl opacity-50 font-bold text-slate-400">No Mission Logs Found</div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
