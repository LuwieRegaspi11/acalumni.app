import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { DollarSign, FileText, Calendar, Shield, Eye, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Card, CardContent } from '@mui/material';

// ================= [ADMIN: AUDITLOGS] =================

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
  severity: 'Low' | 'Medium' | 'High';
}

function mapRow(r: any): AuditLog {
  return {
    id: r.id,
    timestamp: r.occurred_at,
    user: r.actor?.name || 'Unknown',
    role: r.actor_role || '',
    action: r.action,
    module: r.module,
    details: r.details || '',
    ipAddress: r.ip_address || '—',
    severity: r.severity,
  };
}

const actionIcons: Record<string, React.ReactNode> = {
  'Verified Donation': <DollarSign className="w-4 h-4" />,
  'Modified Alumni Record': <Edit className="w-4 h-4" />,
  'Viewed Alumni Directory': <Eye className="w-4 h-4" />,
  'Created Event': <Calendar className="w-4 h-4" />,
  'Deployed Survey': <FileText className="w-4 h-4" />,
  'Deleted Alumni Record': <Trash2 className="w-4 h-4" />
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterModule, setFilterModule] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*, actor:profiles(name)')
      .order('occurred_at', { ascending: false })
      .limit(500)
      .then(({ data }) => setLogs((data || []).map(mapRow)));
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesModule = filterModule === 'All' || log.module === filterModule;
    const matchesSeverity = filterSeverity === 'All' || log.severity === filterSeverity;
    const matchesSearch = log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.details.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesModule && matchesSeverity && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl mb-1">System Audit Logs</h2>
          <p className="text-gray-600">Security and compliance tracking (RA 10175)</p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <span className="text-sm text-gray-600">Cybercrime Prevention Act Compliance</span>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Events</span>
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl">{logs.length}</p>
            <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">High Severity</span>
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl">{logs.filter(l => l.severity === 'High').length}</p>
            <p className="text-xs text-gray-500 mt-1">Requires attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Active Users</span>
              <Shield className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl">{new Set(logs.map(l => l.user)).size}</p>
            <p className="text-xs text-gray-500 mt-1">Unique sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Data Access</span>
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl">{logs.filter(l => l.action.includes('View') || l.action.includes('Modified')).length}</p>
            <p className="text-xs text-gray-500 mt-1">PII interactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextField
              fullWidth
              placeholder="Search by user or action..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FormControl fullWidth>
              <InputLabel>Module</InputLabel>
              <Select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} label="Module">
                <MenuItem value="All">All Modules</MenuItem>
                <MenuItem value="Alumni Database">Alumni Database</MenuItem>
                <MenuItem value="Donations">Donations</MenuItem>
                <MenuItem value="Events">Events</MenuItem>
                <MenuItem value="Tracer Surveys">Tracer Surveys</MenuItem>
                <MenuItem value="Reports">Reports</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} label="Severity">
                <MenuItem value="All">All Levels</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="High">High</MenuItem>
              </Select>
            </FormControl>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <TableContainer component={Paper} className="shadow-sm">
        <Table>
          <TableHead>
            <TableRow className="bg-gray-50">
              <TableCell>Timestamp</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Module</TableCell>
              <TableCell>Details</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Severity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>
                  <div className="text-sm">
                    <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{log.user}</div>
                    <div className="text-xs text-gray-500">{log.role}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {actionIcons[log.action]}
                    <span className="text-sm">{log.action}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Chip label={log.module} size="small" variant="outlined" />
                </TableCell>
                <TableCell className="max-w-xs">
                  <div className="text-sm text-gray-600 truncate">{log.details}</div>
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">{log.ipAddress}</code>
                </TableCell>
                <TableCell>
                  <Chip
                    label={log.severity}
                    size="small"
                    color={
                      log.severity === 'High' ? 'error' :
                      log.severity === 'Medium' ? 'warning' : 'default'
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Security Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent>
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm mb-1">RA 10175 Compliance</h4>
              <p className="text-xs text-gray-700">
                All system activities are logged in accordance with the Cybercrime Prevention Act of 2012.
                Audit logs are retained for 180 days and include user actions, data access, and system modifications.
                Unauthorized access or tampering with audit logs is prohibited and subject to administrative and legal action.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
