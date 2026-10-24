import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getBatchYearOptions } from '../../../lib/batchYears';
import { ALL_PROGRAM_CODES } from '../../../lib/academicPrograms';
import { Users, Shield, CheckCircle, Search, UserPlus } from 'lucide-react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button, Select, MenuItem, FormControl, InputLabel, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, Avatar, Autocomplete, CircularProgress } from '@mui/material';

// ================= [ADMIN: BATCHREPRESENTATIVES] =================
// Representatives are just profiles with role='representative' and
// assigned_batch_year/assigned_department/assigned_program set — there's
// no separate join table, matching how AuthContext/RepresentativeDashboard
// already model a rep's assignment directly on their profile row.

interface Representative {
  id: string;
  name: string;
  email: string;
  batchYear: number;
  department: string;
  program: string;
  assignedDate: string;
  verificationsCount: number;
  profileImage?: string;
}

interface AlumniOption {
  id: string;
  name: string;
  email: string;
  role: string;
  batch_year: number | null;
  department: string | null;
  program: string | null;
  profile_image?: string | null;
}

interface OfferRow {
  id: string; status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  batchYear: number; department: string; program: string;
  name: string; email: string; createdAt: string; respondedAt: string | null;
}

const OFFER_STATUS: Record<OfferRow['status'], { label: string; color: 'warning' | 'success' | 'error' | 'default' }> = {
  pending: { label: 'Waiting for answer', color: 'warning' },
  accepted: { label: 'Accepted', color: 'success' },
  rejected: { label: 'Declined', color: 'error' },
  cancelled: { label: 'Withdrawn', color: 'default' },
};

export default function BatchRepresentatives() {
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedBatchYear, setSelectedBatchYear] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');

  // Alumni picker for the Assign dialog — admin searches and *selects* an
  // existing alumni profile; the batch year/department/program to assign
  // are derived straight from that profile (never independently re-typed),
  // so there's no way to end up assigning a mismatched combination.
  const [alumniSearch, setAlumniSearch] = useState('');
  const [alumniOptions, setAlumniOptions] = useState<AlumniOption[]>([]);
  const [alumniLoading, setAlumniLoading] = useState(false);
  const [selectedAlumnus, setSelectedAlumnus] = useState<AlumniOption | null>(null);
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, assigned_batch_year, assigned_department, assigned_program, assigned_at, batch_verified_by')
      .eq('role', 'representative')
      .order('assigned_at', { ascending: false });
    if (!data) return;
    // verifications count = how many alumni this rep has personally verified
    const { data: verifs } = await supabase.from('profiles').select('batch_verified_by').eq('batch_verified', true);
    const counts: Record<string, number> = {};
    (verifs || []).forEach((v: any) => { if (v.batch_verified_by) counts[v.batch_verified_by] = (counts[v.batch_verified_by] || 0) + 1; });
    setRepresentatives(data.map((r: any) => ({
      id: r.id, name: r.name, email: r.email,
      batchYear: r.assigned_batch_year, department: r.assigned_department || '', program: r.assigned_program || '',
      assignedDate: r.assigned_at || '', verificationsCount: counts[r.id] || 0,
    })));
  };

  const loadOffers = async () => {
    const { data } = await supabase
      .from('rep_offers')
      .select('id, status, batch_year, department, program, created_at, responded_at, alumni:profiles!rep_offers_alumni_id_fkey(name, email)')
      .order('created_at', { ascending: false })
      .limit(30);
    setOffers((data || []).map((o: any) => ({
      id: o.id, status: o.status, batchYear: o.batch_year, department: o.department, program: o.program,
      name: o.alumni?.name || 'Unknown', email: o.alumni?.email || '', createdAt: o.created_at, respondedAt: o.responded_at,
    })));
  };

  useEffect(() => { load(); loadOffers(); }, []);

  // Keep this screen current when an alumnus answers an offer.
  useEffect(() => {
    const channel = supabase.channel('rep-offers-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rep_offers' }, () => { load(); loadOffers(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Debounced search over alumni/representative profiles for the Assign
  // dialog's picker — only fetches while the dialog is open.
  useEffect(() => {
    if (!assignDialogOpen) return;
    let cancelled = false;
    setAlumniLoading(true);
    const timer = setTimeout(async () => {
      let query = supabase
        .from('profiles')
        .select('id, name, email, role, batch_year, department, program, profile_image')
        .in('role', ['alumni', 'representative'])
        .order('name')
        .limit(20);
      if (alumniSearch.trim()) {
        query = query.or(`name.ilike.%${alumniSearch.trim()}%,email.ilike.%${alumniSearch.trim()}%`);
      }
      const { data } = await query;
      if (!cancelled) {
        setAlumniOptions((data || []) as AlumniOption[]);
        setAlumniLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [assignDialogOpen, alumniSearch]);

  const filteredReps = representatives.filter(rep => {
    const matchesSearch = rep.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rep.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !selectedDepartment || rep.department === selectedDepartment;
    const matchesYear = !selectedBatchYear || rep.batchYear?.toString() === selectedBatchYear;
    const matchesProgram = !selectedProgram || rep.program === selectedProgram;
    return matchesSearch && matchesDept && matchesYear && matchesProgram;
  });

  const totalVerifications = representatives.reduce((sum, r) => sum + r.verificationsCount, 0);

  const resetAssignForm = () => {
    setSelectedAlumnus(null); setAlumniSearch(''); setAlumniOptions([]); setAssignError('');
  };

  const handleAssign = async () => {
    setAssignError('');
    if (!selectedAlumnus) {
      setAssignError('Select an alumni profile to assign.');
      return;
    }
    if (!selectedAlumnus.batch_year || !selectedAlumnus.department || !selectedAlumnus.program) {
      setAssignError('This profile is missing a batch year, department, or program — complete their profile before assigning them as a representative.');
      return;
    }
    if (selectedAlumnus.role !== 'alumni') {
      setAssignError(`${selectedAlumnus.name} is already a batch representative. Remove them first if you want to change their assignment.`);
      return;
    }
    setAssigning(true);
    try {
      // The alumnus is NOT promoted here — they get an offer (a notification
      // with Accept / Decline). Their account only becomes a batch
      // representative when they accept; the database function also checks
      // that the profile is approved and complete. See
      // supabase/batch_rep_offers.sql.
      const { error } = await supabase.rpc('offer_batch_rep', { p_alumni_id: selectedAlumnus.id });
      if (error) {
        setAssignError(error.message || 'Could not send the offer.');
        return;
      }
      setNotice(`Offer sent to ${selectedAlumnus.name}. They can accept or decline from their notifications — you'll be notified of their answer.`);
      setAssignDialogOpen(false);
      resetAssignForm();
      await loadOffers();
    } finally {
      setAssigning(false);
    }
  };

  const cancelOffer = async (offerId: string) => {
    await supabase.from('rep_offers').update({ status: 'cancelled', responded_at: new Date().toISOString() }).eq('id', offerId).eq('status', 'pending');
    await loadOffers();
  };

  const handleRemove = async (rep: Representative) => {
    await supabase
      .from('profiles')
      .update({ role: 'alumni', assigned_batch_year: null, assigned_department: null, assigned_program: null, assigned_at: null })
      .eq('id', rep.id);
    await supabase.rpc('log_audit', {
      p_action: `Removed ${rep.name} as batch representative`,
      p_module: 'Batch Representatives',
      p_details: `Batch ${rep.batchYear} · ${rep.department} · ${rep.program}`,
      p_severity: 'Medium',
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl mb-1 bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent flex items-center gap-2">
            👥 Batch Representatives
          </h2>
          <p className="text-gray-600">Manage batch representatives for decentralized verification</p>
        </div>
        <Button
          variant="contained"
          startIcon={<UserPlus className="w-4 h-4" />}
          onClick={() => setAssignDialogOpen(true)}
          className="bg-gradient-to-r from-teal-600 to-green-600"
        >
          Offer Representative Role
        </Button>
      </div>

      {notice && (
        <div role="status" className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 flex items-start justify-between gap-3">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 shadow-lg">
        <CardContent>
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm mb-1 font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">🔒 Representative System</h4>
              <p className="text-xs text-gray-700">
                Batch Representatives can only verify alumni from their assigned <strong>batch year + department + program</strong>. Only ONE representative per batch year + department + program combination (Unique Constraint). All verification actions are audited per RA 10175.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-all border-l-4 border-teal-500 animate-slide-up">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Active Representatives</span>
              <div className="bg-teal-100 p-2 rounded-lg">
                <UserPlus className="w-5 h-5 text-teal-500" />
              </div>
            </div>
            <p className="text-3xl bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">{representatives.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-all border-l-4 border-blue-500 animate-slide-up delay-100">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Total Verifications</span>
              <div className="bg-blue-100 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-3xl bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{totalVerifications}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-all border-l-4 border-purple-500 animate-slide-up delay-200">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Covered Batches</span>
              <div className="bg-purple-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-3xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{representatives.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <TextField
              fullWidth
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <Search className="w-4 h-4 text-gray-400 mr-2" /> }}
            />
            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} label="Department">
                <MenuItem value="">All Departments</MenuItem>
                <MenuItem value="CSE">CSE</MenuItem>
                <MenuItem value="CTHM">CTHM</MenuItem>
                <MenuItem value="BAA">BAA</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Program</InputLabel>
              <Select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} label="Program">
                <MenuItem value="">All Programs</MenuItem>
                {ALL_PROGRAM_CODES.map(p => (
                  <MenuItem key={p} value={p}>{p}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Batch Year</InputLabel>
              <Select value={selectedBatchYear} onChange={(e) => setSelectedBatchYear(e.target.value)} label="Batch Year">
                <MenuItem value="">All Years</MenuItem>
                {getBatchYearOptions().map(year => (
                  <MenuItem key={year} value={year.toString()}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </CardContent>
      </Card>

      {/* Representatives Table */}
      <TableContainer component={Paper} className="shadow-lg">
        <Table>
          <TableHead>
            <TableRow className="bg-gradient-to-r from-teal-50 to-green-50">
              <TableCell>Representative</TableCell>
              <TableCell>Assignment</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Program</TableCell>
              <TableCell>Assigned Date</TableCell>
              <TableCell>Verifications</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredReps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-gray-500">No batch representatives found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredReps.map((rep) => (
                <TableRow key={rep.id} hover>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar src={rep.profileImage} alt={rep.name} />
                      <div>
                        <p className="text-sm">{rep.name}</p>
                        <p className="text-xs text-gray-500">{rep.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip label={`Batch ${rep.batchYear}`} size="small" color="primary" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={rep.department}
                      size="small"
                      sx={{
                        backgroundColor: rep.department === 'CSE' ? '#a855f7' :
                                       rep.department === 'CTHM' ? '#ef4444' :
                                       rep.department === 'BAA' ? '#eab308' : '#6b7280',
                        color: 'white'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip label={rep.program} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{rep.assignedDate ? new Date(rep.assignedDate).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-teal-600">{rep.verificationsCount}</span>
                  </TableCell>
                  <TableCell>
                    <Button size="small" color="error" onClick={() => handleRemove(rep)}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Offers — what the Alumni Head has sent and how each alumnus answered */}
      <TableContainer component={Paper} className="shadow-lg">
        <div className="px-4 pt-4">
          <h3 className="font-bold text-gray-800">Representative Offers</h3>
          <p className="text-xs text-gray-500">An alumnus becomes a batch representative only after accepting. Their answer also arrives as a notification.</p>
        </div>
        <div className="overflow-x-auto">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Alumnus</TableCell>
              <TableCell>Offered for</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Sent</TableCell>
              <TableCell>Answered</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {offers.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6"><p className="text-gray-500 text-sm">No offers sent yet</p></TableCell></TableRow>
            ) : offers.map(o => (
              <TableRow key={o.id} hover>
                <TableCell>
                  <p className="text-sm">{o.name}</p>
                  <p className="text-xs text-gray-500">{o.email}</p>
                </TableCell>
                <TableCell>Batch {o.batchYear} · {o.department} · {o.program}</TableCell>
                <TableCell><Chip size="small" label={OFFER_STATUS[o.status].label} color={OFFER_STATUS[o.status].color} /></TableCell>
                <TableCell>{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>{o.respondedAt ? new Date(o.respondedAt).toLocaleDateString() : '—'}</TableCell>
                <TableCell>
                  {o.status === 'pending' && <Button size="small" color="error" onClick={() => cancelOffer(o.id)}>Withdraw</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </TableContainer>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => { setAssignDialogOpen(false); resetAssignForm(); }} maxWidth="sm" fullWidth>
        <DialogTitle>Offer Batch Representative Role</DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
              <p className="text-xs text-gray-700">
                ⚠️ <strong>Unique Constraint:</strong> Only ONE representative can be assigned per <strong>Batch Year + Department + Program</strong> combination. If the alumnus accepts, they replace any existing representative for that specific combination. Nothing changes until they accept.
              </p>
            </div>
            {assignError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">{assignError}</div>
            )}

            <Autocomplete
              fullWidth
              options={alumniOptions}
              value={selectedAlumnus}
              onChange={(_e, value) => setSelectedAlumnus(value)}
              inputValue={alumniSearch}
              onInputChange={(_e, value) => setAlumniSearch(value)}
              getOptionLabel={(o) => `${o.name} (${o.email})`}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              loading={alumniLoading}
              noOptionsText={alumniSearch ? 'No matching alumni' : 'Start typing a name or email'}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <div className="flex items-center gap-3 py-1">
                    <Avatar src={option.profile_image || undefined} alt={option.name} sx={{ width: 32, height: 32 }} />
                    <div>
                      <p className="text-sm">{option.name} {option.role === 'representative' && <Chip label="Current rep" size="small" color="primary" className="ml-1" />}</p>
                      <p className="text-xs text-gray-500">{option.email} · Batch {option.batch_year || '—'} · {option.department || '—'} · {option.program || '—'}</p>
                    </div>
                  </div>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search & Select Alumni"
                  placeholder="Type a name or email…"
                  helperText="Pick the alumnus to make the offer to — their own batch year, department, and program become the assignment if they accept"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <Search className="w-4 h-4 text-gray-400 ml-2" />,
                    endAdornment: (
                      <>
                        {alumniLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            {selectedAlumnus && (
              <Card variant="outlined" className="bg-teal-50/50">
                <CardContent>
                  <p className="text-xs text-gray-500 mb-2">Will be offered to represent:</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip label={`Batch ${selectedAlumnus.batch_year}`} size="small" color="primary" />
                    <Chip label={selectedAlumnus.department} size="small" />
                    <Chip label={selectedAlumnus.program} size="small" variant="outlined" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAssignDialogOpen(false); resetAssignForm(); }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={assigning}
            className="bg-gradient-to-r from-teal-600 to-green-600"
          >
            {assigning ? 'Sending…' : 'Send Offer'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
