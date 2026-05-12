"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import {
  Activity, Users, MessageSquare, Hash, Wifi, WifiOff,
  RefreshCw, Circle, Clock, ArrowRight, Radio,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';

/* ── Socket URL — strip /api/v1 to get the server root ── */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
const SOCKET_URL = API_URL.replace(/\/api\/v\d+$/, '');

/* ── Types ── */
interface ChatStats {
  activeRooms: number;
  totalMessages: number;
  messagesToday: number;
  onlineUsers: number;
  activeMembers: number;
}

interface OnlineUser {
  userId: number;
  socketId: string;
  name: string;
  avatar: string | null;
  rooms: number[];
  connectedAt: string;
  lastSeen: string;
}

interface RoomActivity {
  id: number;
  name: string;
  room_type: string;
  is_active: boolean;
  memberCount: number;
  onlineCount: number;
  lastMessage: {
    id: number;
    content: string;
    senderName: string;
    timestamp: string;
  } | null;
}

interface LiveMessage {
  id: number;
  room_id: number;
  content: string | null;
  message_type: string;
  created_at: string;
  sender_id: number;
  users: { id: number; first_name: string; last_name: string; profile_picture: string | null } | null;
  chat_rooms: { id: number; name: string } | null;
}

/* ── Stat card ── */
function StatCard({ label, value, icon: Icon, color, loading }: { label: string; value: number | string; icon: any; color: string; loading: boolean }) {
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-5"><Skeleton className="h-16 w-full" /></div>;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════ */
/* PAGE                                          */
/* ══════════════════════════════════════════════ */
export default function ChatMonitoringPage() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [rooms, setRooms] = useState<RoomActivity[]>([]);
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveFeed, setLiveFeed] = useState<any[]>([]); // push events from server

  /* ── Connect to /admin namespace ── */
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const socket = io(`${SOCKET_URL}/admin`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      loadAll(socket);
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    // Live push events
    socket.on('chat_activity', (data: any) => {
      setLiveFeed(prev => [{ ...data, _id: Date.now() + Math.random() }, ...prev].slice(0, 50));
      // If new message, also add to recent messages
      if (data.type === 'new_message' && data.message) {
        setLiveMessages(prev => [data.message, ...prev].slice(0, 30));
      }
    });

    socket.on('presence_change', (data: any) => {
      setLiveFeed(prev => [{ ...data, _id: Date.now() + Math.random() }, ...prev].slice(0, 50));
      // Refresh online users on presence change
      refreshOnlineUsers(socket);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  /* ── Load all data via socket events ── */
  const loadAll = useCallback((socket: Socket) => {
    setLoading(true);

    socket.emit('get_chat_stats', {}, (res: any) => {
      if (res.success) setStats(res.stats);
    });

    socket.emit('get_online_users', {}, (res: any) => {
      if (res.success) setOnlineUsers(res.users || []);
    });

    socket.emit('get_room_activity', { limit: 20 }, (res: any) => {
      if (res.success) setRooms(res.rooms || []);
    });

    socket.emit('get_recent_messages', { limit: 30 }, (res: any) => {
      if (res.success) setLiveMessages(res.messages || []);
      setLoading(false);
    });
  }, []);

  const refreshOnlineUsers = useCallback((socket: Socket) => {
    socket.emit('get_online_users', {}, (res: any) => {
      if (res.success) setOnlineUsers(res.users || []);
    });
    socket.emit('get_online_count', {}, (res: any) => {
      if (res.success && stats) setStats(prev => prev ? { ...prev, onlineUsers: res.count } : prev);
    });
  }, [stats]);

  const handleRefresh = () => {
    if (socketRef.current?.connected) loadAll(socketRef.current);
  };

  /* ── Render ── */
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat Monitoring"
        description="Real-time monitoring of chat system activity, online users, and message flow"
        actions={
          <div className="flex items-center gap-3">
            <Badge className={cn('flex items-center gap-1.5 px-3 py-1', connected ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
              {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {connected ? 'Connected' : 'Disconnected'}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={!connected}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        }
      />

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Online Users" value={stats?.onlineUsers ?? 0} icon={Users} color="bg-emerald-500" loading={loading} />
        <StatCard label="Active Rooms" value={stats?.activeRooms ?? 0} icon={Hash} color="bg-blue-500" loading={loading} />
        <StatCard label="Messages Today" value={stats?.messagesToday ?? 0} icon={MessageSquare} color="bg-violet-500" loading={loading} />
        <StatCard label="Total Messages" value={stats?.totalMessages?.toLocaleString() ?? '0'} icon={Activity} color="bg-amber-500" loading={loading} />
        <StatCard label="Active Members" value={stats?.activeMembers ?? 0} icon={Users} color="bg-cyan-500" loading={loading} />
      </div>

      {/* ── Two-column layout: Online Users + Live Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Online Users */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Circle className="h-3 w-3 text-emerald-500 fill-emerald-500" />
              Online Users ({onlineUsers.length})
            </h3>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="p-5 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : onlineUsers.length === 0 ? (
              <div className="p-8"><EmptyState icon={Users} title="No users online" description="No users are currently connected" /></div>
            ) : (
              <div className="divide-y divide-slate-50">
                {onlineUsers.map(u => (
                  <div key={u.userId} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="relative">
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 text-xs font-semibold">
                          {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.rooms.length} room{u.rooms.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fromNow(u.connectedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-rose-500" />
              Live Activity Feed
            </h3>
            {liveFeed.length > 0 && (
              <button onClick={() => setLiveFeed([])} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {liveFeed.length === 0 ? (
              <div className="p-8"><EmptyState icon={Activity} title="No live events yet" description="Events will appear here in real-time" /></div>
            ) : (
              <div className="divide-y divide-slate-50">
                {liveFeed.map((event, i) => (
                  <div key={event._id || i} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-[10px] px-1.5 py-0',
                        event.type === 'new_message' ? 'bg-blue-50 text-blue-700' :
                        event.type === 'message_edited' ? 'bg-amber-50 text-amber-700' :
                        event.type === 'message_deleted' ? 'bg-red-50 text-red-700' :
                        event.type === 'online' ? 'bg-emerald-50 text-emerald-700' :
                        event.type === 'offline' ? 'bg-slate-100 text-slate-600' :
                        'bg-slate-50 text-slate-600'
                      )}>
                        {event.type?.replace(/_/g, ' ')}
                      </Badge>
                      {event.user?.name && <span className="text-xs font-medium text-slate-700">{event.user.name}</span>}
                      {event.roomId && <span className="text-xs text-slate-400">Room #{event.roomId}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{event.timestamp ? fromNow(event.timestamp) : 'just now'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Room Activity ── */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Hash className="h-4 w-4 text-blue-500" />
            Room Activity
          </h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : rooms.length === 0 ? (
          <div className="p-8"><EmptyState icon={Hash} title="No active rooms" description="No chat rooms found" /></div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Room</TH>
                <TH>Type</TH>
                <TH>Members</TH>
                <TH>Online</TH>
                <TH>Last Message</TH>
                <TH>Last Activity</TH>
              </TR>
            </THead>
            <TBody>
              {rooms.map(room => (
                <TR key={room.id}>
                  <TD>
                    <span className="font-medium text-slate-900">{room.name}</span>
                    <span className="ml-1.5 text-xs text-slate-400">#{room.id}</span>
                  </TD>
                  <TD>
                    <Badge className={cn('text-[10px]',
                      room.room_type === 'group' ? 'bg-blue-50 text-blue-700' :
                      room.room_type === 'direct' ? 'bg-violet-50 text-violet-700' :
                      room.room_type === 'channel' ? 'bg-emerald-50 text-emerald-700' :
                      'bg-slate-50 text-slate-600'
                    )}>
                      {room.room_type}
                    </Badge>
                  </TD>
                  <TD>{room.memberCount}</TD>
                  <TD>
                    {room.onlineCount > 0 ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                        {room.onlineCount}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TD>
                  <TD>
                    {room.lastMessage ? (
                      <div className="max-w-[200px]">
                        <p className="text-xs text-slate-700 truncate">{room.lastMessage.content || '(attachment)'}</p>
                        <p className="text-[10px] text-slate-400">by {room.lastMessage.senderName}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No messages</span>
                    )}
                  </TD>
                  <TD>
                    <span className="text-xs text-slate-500">
                      {room.lastMessage?.timestamp ? fromNow(room.lastMessage.timestamp) : '—'}
                    </span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {/* ── Recent Messages ── */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-violet-500" />
            Recent Messages
          </h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : liveMessages.length === 0 ? (
          <div className="p-8"><EmptyState icon={MessageSquare} title="No messages" description="No recent messages found" /></div>
        ) : (
          <div className="max-h-[440px] overflow-y-auto divide-y divide-slate-50">
            {liveMessages.map(msg => (
              <div key={msg.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                {msg.users?.profile_picture ? (
                  <img src={msg.users.profile_picture} alt="" className="h-7 w-7 rounded-full object-cover mt-0.5" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-600 text-[10px] font-semibold mt-0.5">
                    {msg.users ? `${msg.users.first_name?.[0] || ''}${msg.users.last_name?.[0] || ''}`.toUpperCase() : '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      {msg.users ? `${msg.users.first_name} ${msg.users.last_name}`.trim() : `User #${msg.sender_id}`}
                    </span>
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                    <span className="text-xs text-slate-500">{msg.chat_rooms?.name || `Room #${msg.room_id}`}</span>
                    {msg.message_type !== 'text' && (
                      <Badge className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0">{msg.message_type}</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700 truncate">{msg.content || `(${msg.message_type})`}</p>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap mt-0.5">{fromNow(msg.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
