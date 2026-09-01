import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Users, TrendingUp, DollarSign, FileText, Download } from 'lucide-react';
import { useDarkMode } from '../shared/DarkModeContext';
import { Button, Select, MenuItem, FormControl, InputLabel, Card, CardContent } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

// ================= [ADMIN: REPORTS] =================

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Reports() {
  const { dark } = useDarkMode();
  const [reportType, setReportType] = useState('alumni');
  const [department, setDepartment] = useState('All');

  const [donationTrend, setDonationTrend] = useState<{ month: string; amount: number }[]>([]);
  const [alumniByYear, setAlumniByYear] = useState<{ year: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: alumni } = await supabase
        .from('profiles')
        .select('department, batch_year')
        .eq('role', 'alumni');

      const yearMap: Record<string, number> = {};
      (alumni || []).forEach((a: any) => {
        if (a.batch_year) yearMap[a.batch_year] = (yearMap[a.batch_year] || 0) + 1;
      });
      setAlumniByYear(Object.entries(yearMap).map(([year, count]) => ({ year, count })).sort((a, b) => Number(a.year) - Number(b.year)));

      const { data: donations } = await supabase
        .from('donations')
        .select('amount, created_at')
        .eq('status', 'verified');
      const monthMap: Record<string, number> = {};
      (donations || []).forEach((d: any) => {
        const label = MONTH_LABELS[new Date(d.created_at).getMonth()];
        monthMap[label] = (monthMap[label] || 0) + Number(d.amount);
      });
      setDonationTrend(MONTH_LABELS.filter(m => monthMap[m] !== undefined).map(month => ({ month, amount: monthMap[month] })));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl mb-1">Reports & Analytics</h2>
          <p className="text-gray-600">Departmental analytics and automated reporting</p>
        </div>
        <Button
          variant="contained"
          startIcon={<Download className="w-4 h-4" />}
          className="bg-blue-600"
          disabled
          title="Coming soon"
        >
          Export All Reports
        </Button>
      </div>

      {/* Quick Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="opacity-60 cursor-not-allowed" title="Coming soon">
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              <Download className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm mb-1">Donation Summary</h4>
            <p className="text-xs text-gray-600">Financial contributions report</p>
          </CardContent>
        </Card>
        <Card className="opacity-60 cursor-not-allowed" title="Coming soon">
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <Users className="w-8 h-8 text-purple-500" />
              <Download className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm mb-1">Alumni Directory</h4>
            <p className="text-xs text-gray-600">Complete alumni listing</p>
          </CardContent>
        </Card>
        <Card className="opacity-60 cursor-not-allowed" title="Coming soon">
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-8 h-8 text-orange-500" />
              <Download className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm mb-1">Analytics Dashboard</h4>
            <p className="text-xs text-gray-600">Comprehensive analytics PDF</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormControl fullWidth>
              <InputLabel>Report Type</InputLabel>
              <Select value={reportType} onChange={(e) => setReportType(e.target.value)} label="Report Type">
                <MenuItem value="donations">Donation Trends</MenuItem>
                <MenuItem value="alumni">Alumni Distribution</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select value={department} onChange={(e) => setDepartment(e.target.value)} label="Department">
                <MenuItem value="All">All Departments</MenuItem>
                <MenuItem value="CSE">CSE</MenuItem>
                <MenuItem value="CTHM">CTHM</MenuItem>
                <MenuItem value="BAA">BAA</MenuItem>
              </Select>
            </FormControl>
            <Button variant="outlined" fullWidth className="h-14">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Donation Trends */}
      <Card>
        <CardContent>
          <h3 className="text-lg mb-4">Donation Trends (2026)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={donationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e5e7eb'} />
              <XAxis dataKey="month" tick={{ fill: dark ? '#b8d4f0' : '#4b5563' }} axisLine={{ stroke: dark ? '#334155' : '#d1d5db' }} />
              <YAxis tick={{ fill: dark ? '#b8d4f0' : '#4b5563' }} axisLine={{ stroke: dark ? '#334155' : '#d1d5db' }} />
              <Tooltip formatter={(value) => `₱${Number(value).toLocaleString()}`} />
              <Legend wrapperStyle={{ color: dark ? '#b8d4f0' : '#4b5563' }} />
              <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} name="Donations (₱)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alumni Distribution */}
      <Card>
        <CardContent>
          <h3 className="text-lg mb-4">Alumni Distribution by Batch Year</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={alumniByYear}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e5e7eb'} />
              <XAxis dataKey="year" tick={{ fill: dark ? '#b8d4f0' : '#4b5563' }} axisLine={{ stroke: dark ? '#334155' : '#d1d5db' }} />
              <YAxis tick={{ fill: dark ? '#b8d4f0' : '#4b5563' }} axisLine={{ stroke: dark ? '#334155' : '#d1d5db' }} />
              <Tooltip contentStyle={{ background: dark ? '#1a2332' : '#ffffff', border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`, borderRadius: 8, color: dark ? '#e8f2ff' : '#111827' }} />
              <Legend wrapperStyle={{ color: dark ? '#b8d4f0' : '#4b5563' }} />
              <Bar dataKey="count" fill="#3b82f6" name="Number of Alumni" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* One-Click Report Templates */}
      <Card>
        <CardContent>
          <h3 className="text-lg mb-4">One-Click Report Generation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-sm mb-1">Accreditation Report 2026</h4>
                  <p className="text-xs text-gray-600">Complete alumni report for accreditation requirements</p>
                </div>
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
              <Button variant="outlined" size="small" fullWidth className="mt-2" disabled title="Coming soon">
                Generate PDF
              </Button>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-sm mb-1">Donor Appreciation Letters</h4>
                  <p className="text-xs text-gray-600">Auto-generate thank you letters for all verified donations</p>
                </div>
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
              <Button variant="outlined" size="small" fullWidth className="mt-2" disabled title="Coming soon">
                Generate Letters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
