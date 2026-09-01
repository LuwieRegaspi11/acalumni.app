import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Users, Calendar, BookOpen, GraduationCap } from 'lucide-react';
import { useDarkMode } from '../shared/DarkModeContext';
import { Select, MenuItem, FormControl, InputLabel, Card, CardContent } from '@mui/material';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ================= [ADMIN: POPULATIONANALYTICS] =================

interface AlumniData {
  department: string;
  program: string;
  batchYear: number;
}

const COLORS = {
  CSE: '#a855f7',
  CTHM: '#ef4444',
  BAA: '#eab308'
};

export default function PopulationAnalytics() {
  const { dark } = useDarkMode();
  const [selectedView, setSelectedView] = useState<'overall' | 'department' | 'program' | 'year'>('overall');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [alumniData, setAlumniData] = useState<AlumniData[]>([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('department, program, batch_year')
      .eq('role', 'alumni')
      .then(({ data }) => setAlumniData(
        (data || [])
          .filter((r: any) => r.department && r.program && r.batch_year)
          .map((r: any) => ({ department: r.department, program: r.program, batchYear: r.batch_year }))
      ));
  }, []);

  const totalPopulation = alumniData.length;

  // Count by department
  const byDepartment = Object.entries(
    alumniData.reduce((acc, alum) => {
      acc[alum.department] = (acc[alum.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value, color: COLORS[name as keyof typeof COLORS] }));

  // Count by program
  const byProgram = Object.entries(
    alumniData.reduce((acc, alum) => {
      acc[alum.program] = (acc[alum.program] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Count by batch year
  const byBatchYear = Object.entries(
    alumniData.reduce((acc, alum) => {
      acc[alum.batchYear] = (acc[alum.batchYear] || 0) + 1;
      return acc;
    }, {} as Record<number, number>)
  ).map(([name, value]) => ({ name, value })).sort((a, b) => parseInt(a.name) - parseInt(b.name));

  // Count by program within selected department
  const byProgramInDept = selectedDepartment !== 'All'
    ? Object.entries(
        alumniData
          .filter(a => a.department === selectedDepartment)
          .reduce((acc, alum) => {
            acc[alum.program] = (acc[alum.program] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
      ).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-1 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
          📊 Population Analytics
        </h2>
        <p className="text-gray-600">Comprehensive alumni population statistics and demographics</p>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-all border-l-4 border-purple-500 animate-slide-up">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Total Alumni Population</span>
              <div className="bg-purple-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-4xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-bold">{totalPopulation}</p>
            <p className="text-xs text-gray-500 mt-1">Asian College Alumni</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-all border-l-4 border-blue-500 animate-slide-up delay-100">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Total Departments</span>
              <div className="bg-blue-100 p-2 rounded-lg">
                <GraduationCap className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-4xl bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent font-bold">{byDepartment.length}</p>
            <p className="text-xs text-gray-500 mt-1">CSE, CTHM, BAA</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-all border-l-4 border-green-500 animate-slide-up delay-200">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Total Programs</span>
              <div className="bg-green-100 p-2 rounded-lg">
                <BookOpen className="w-5 h-5 text-green-500" />
              </div>
            </div>
            <p className="text-4xl bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent font-bold">{byProgram.length}</p>
            <p className="text-xs text-gray-500 mt-1">Across all departments</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-all border-l-4 border-orange-500 animate-slide-up delay-300">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Batch Years</span>
              <div className="bg-orange-100 p-2 rounded-lg">
                <Calendar className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <p className="text-4xl bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent font-bold">{byBatchYear.length}</p>
            <p className="text-xs text-gray-500 mt-1">2018 - 2021</p>
          </CardContent>
        </Card>
      </div>

      {/* View Selector */}
      <Card>
        <CardContent>
          <FormControl fullWidth>
            <InputLabel>Select View</InputLabel>
            <Select value={selectedView} onChange={(e) => setSelectedView(e.target.value as any)} label="Select View">
              <MenuItem key="overall" value="overall">Overall Distribution</MenuItem>
              <MenuItem key="department" value="department">By Department</MenuItem>
              <MenuItem key="program" value="program">By Program/Course</MenuItem>
              <MenuItem key="year" value="year">By Batch Year</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {/* Charts */}
      {selectedView === 'overall' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-lg">
            <CardContent>
              <h3 className="text-lg mb-4 font-semibold">Alumni by Department</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={byDepartment}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {byDepartment.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: dark ? '#1a2332' : '#ffffff', border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`, borderRadius: 8, color: dark ? '#e8f2ff' : '#111827' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {byDepartment.map((dept) => (
                  <div key={dept.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: dept.color }}></div>
                      <span>{dept.name}</span>
                    </div>
                    <span className="font-semibold">{dept.value} ({((dept.value / totalPopulation) * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardContent>
              <h3 className="text-lg mb-4 font-semibold">Alumni by Batch Year</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byBatchYear}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e5e7eb'} />
                  <XAxis dataKey="name" tick={{ fill: dark ? '#b8d4f0' : '#4b5563' }} axisLine={{ stroke: dark ? '#334155' : '#d1d5db' }} />
                  <YAxis tick={{ fill: dark ? '#b8d4f0' : '#4b5563' }} axisLine={{ stroke: dark ? '#334155' : '#d1d5db' }} />
                  <Tooltip contentStyle={{ background: dark ? '#1a2332' : '#ffffff', border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`, borderRadius: 8, color: dark ? '#e8f2ff' : '#111827' }} />
                  <Legend wrapperStyle={{ color: dark ? '#b8d4f0' : '#4b5563' }} />
                  <Bar dataKey="value" fill="#8b5cf6" name="Alumni Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'department' && (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <h3 className="text-lg mb-4 font-semibold">Department Breakdown</h3>
              <div className="space-y-4">
                {byDepartment.map((dept) => (
                  <div key={dept.name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }}></div>
                        <h4 className="font-semibold">{dept.name}</h4>
                      </div>
                      <span className="text-2xl font-bold">{dept.value}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          backgroundColor: dept.color,
                          width: `${(dept.value / totalPopulation) * 100}%`
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {((dept.value / totalPopulation) * 100).toFixed(1)}% of total population
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'program' && (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Program/Course Distribution</h3>
                <FormControl style={{ minWidth: 200 }}>
                  <InputLabel>Filter by Department</InputLabel>
                  <Select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    label="Filter by Department"
                  >
                    <MenuItem key="all-dept2" value="All">All Departments</MenuItem>
                    <MenuItem key="CSE2" value="CSE">CSE</MenuItem>
                    <MenuItem key="CTHM2" value="CTHM">CTHM</MenuItem>
                    <MenuItem key="BAA2" value="BAA">BAA</MenuItem>
                  </Select>
                </FormControl>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={selectedDepartment === 'All' ? byProgram : byProgramInDept}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e5e7eb'} />
                  <XAxis dataKey="name" tick={{ fill: dark ? '#b8d4f0' : '#4b5563' }} axisLine={{ stroke: dark ? '#334155' : '#d1d5db' }} />
                  <YAxis tick={{ fill: dark ? '#b8d4f0' : '#4b5563' }} axisLine={{ stroke: dark ? '#334155' : '#d1d5db' }} />
                  <Tooltip contentStyle={{ background: dark ? '#1a2332' : '#ffffff', border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`, borderRadius: 8, color: dark ? '#e8f2ff' : '#111827' }} />
                  <Legend wrapperStyle={{ color: dark ? '#b8d4f0' : '#4b5563' }} />
                  <Bar dataKey="value" fill="#10b981" name="Alumni Count" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {(selectedDepartment === 'All' ? byProgram : byProgramInDept).map((prog) => (
                  <Card key={prog.name} className="shadow-sm">
                    <CardContent>
                      <p className="text-xs text-gray-600">Program</p>
                      <p className="font-semibold">{prog.name}</p>
                      <p className="text-2xl text-green-600 font-bold">{prog.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'year' && (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <h3 className="text-lg mb-4 font-semibold">Batch Year Analysis</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={byBatchYear}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e5e7eb'} />
                  <XAxis dataKey="name" tick={{ fill: dark ? '#b8d4f0' : '#4b5563' }} axisLine={{ stroke: dark ? '#334155' : '#d1d5db' }} />
                  <YAxis tick={{ fill: dark ? '#b8d4f0' : '#4b5563' }} axisLine={{ stroke: dark ? '#334155' : '#d1d5db' }} />
                  <Tooltip contentStyle={{ background: dark ? '#1a2332' : '#ffffff', border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`, borderRadius: 8, color: dark ? '#e8f2ff' : '#111827' }} />
                  <Legend wrapperStyle={{ color: dark ? '#b8d4f0' : '#4b5563' }} />
                  <Bar dataKey="value" fill="#f59e0b" name="Alumni Count" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {byBatchYear.map((year) => (
                  <Card key={year.name} className="shadow-sm border-l-4 border-orange-500">
                    <CardContent>
                      <p className="text-xs text-gray-600">Batch Year</p>
                      <p className="text-xl font-semibold">{year.name}</p>
                      <p className="text-3xl text-orange-600 font-bold">{year.value}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {((year.value / totalPopulation) * 100).toFixed(1)}% of total
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
