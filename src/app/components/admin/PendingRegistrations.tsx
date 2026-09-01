import { useState, useEffect } from 'react';
import { Shield, UserCheck, Search, Eye, CheckCircle, XCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, Avatar, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { supabase } from '../../../lib/supabaseClient';
import { useNotifications } from '../shared/NotificationContext';

// ================= [ADMIN: PENDINGREGISTRATIONS] =================

interface PendingAlumni {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  program: string;
  studentId: string;
  batchYear: number;
  graduationDate: string;
  profileImage?: string;
  registeredDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  isBatchVerified: boolean;
  batchVerifiedBy?: string;
  idType?: string;
  idDocumentUrl?: string;
}

const ID_TYPE_LABELS: Record<string, string> = {
  school_id: 'Alumni ID',
  drivers_license: "Driver's License",
  passport: 'Passport',
  national_id: 'National / Philippine ID',
  voters_id: "Voter's ID",
  other: 'Other Government-Issued ID',
};

function mapRowToAlumni(row: any): PendingAlumni {
  const statusMap: Record<string, PendingAlumni['status']> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  };
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    department: row.department || '',
    program: row.program || '',
    studentId: row.student_id || '',
    batchYear: row.batch_year || 0,
    graduationDate: row.graduation_date || '',
    profileImage: row.profile_image || undefined,
    registeredDate: row.created_at,
    status: statusMap[row.registration_status] || 'Pending',
    isBatchVerified: !!row.batch_verified,
    batchVerifiedBy: undefined,
    idType: row.id_type || undefined,
    idDocumentUrl: row.id_document_url || undefined,
  };
}

export default function PendingRegistrations() {
  const { trigger } = useNotifications();
  const [registrations, setRegistrations] = useState<PendingAlumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlumni, setSelectedAlumni] = useState<PendingAlumni | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [batchYearFilter, setBatchYearFilter] = useState('All');

  const loadRegistrations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'alumni')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setRegistrations(data.map(mapRowToAlumni));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRegistrations();
  }, []);

  const batchYears = Array.from(new Set(registrations.map(r => r.batchYear).filter(Boolean)))
    .sort((a, b) => b - a);

  const filteredRegistrations = registrations.filter(reg =>
    (reg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     reg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
     reg.studentId.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (batchYearFilter === 'All' || reg.batchYear === Number(batchYearFilter))
  );

  const pendingCount = registrations.filter(r => r.status === 'Pending').length;

  const handleView = (alumni: PendingAlumni) => {
    setSelectedAlumni(alumni);
    setViewDialogOpen(true);
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ registration_status: 'approved', active: true })
      .eq('id', id);
    if (!error) {
      setRegistrations(registrations.map(reg =>
        reg.id === id ? { ...reg, status: 'Approved' as const } : reg
      ));
      trigger({
        title: 'Registration Approved',
        message: 'Your alumni account has been approved. Welcome aboard!',
        type: 'success',
        targetUserId: id,
      });
    }
    setViewDialogOpen(false);
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ registration_status: 'rejected' })
      .eq('id', id);
    if (!error) {
      setRegistrations(registrations.map(reg =>
        reg.id === id ? { ...reg, status: 'Rejected' as const } : reg
      ));
      trigger({
        title: 'Registration Update',
        message: 'Your registration could not be approved. Please contact the alumni office for details.',
        type: 'warning',
        targetUserId: id,
      });
    }
    setViewDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl mb-1 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent flex items-center gap-2">
            Pending Registrations
          </h2>
          <p className="text-gray-600">Review and approve new alumni registrations</p>
        </div>
        <Chip
          label={`${pendingCount} Pending`}
          color={pendingCount > 0 ? 'warning' : 'default'}
          icon={<UserCheck className="w-4 h-4" />}
          className="shadow-md"
          sx={{
            animation: pendingCount > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
            fontSize: '1rem',
            padding: '1.5rem 0.5rem'
          }}
        />
      </div>

      {/* Search */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <TextField
              fullWidth
              placeholder="Search by name, email, or alumni ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search className="w-4 h-4 text-gray-400 mr-2" />
              }}
            />
            <FormControl sx={{ minWidth: { xs: '100%', sm: 180 } }}>
              <InputLabel id="batch-year-filter-label">Batch Year</InputLabel>
              <Select
                labelId="batch-year-filter-label"
                label="Batch Year"
                value={batchYearFilter}
                onChange={(e) => setBatchYearFilter(e.target.value)}
              >
                <MenuItem value="All">All Batch Years</MenuItem>
                {batchYears.map(year => (
                  <MenuItem key={year} value={String(year)}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-orange-500 animate-slide-up">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Pending Review</span>
              <div className="bg-orange-100 p-2 rounded-lg">
                <UserCheck className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <p className="text-3xl bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-green-500 animate-slide-up delay-100">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Approved</span>
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>
            <p className="text-3xl bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{registrations.filter(r => r.status === 'Approved').length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-red-500 animate-slide-up delay-200">
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 font-medium">Rejected</span>
              <div className="bg-red-100 p-2 rounded-lg">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <p className="text-3xl bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">{registrations.filter(r => r.status === 'Rejected').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Registrations Table */}
      <TableContainer component={Paper} className="shadow-sm">
        <Table>
          <TableHead>
            <TableRow className="bg-gray-50">
              <TableCell>Alumni</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Batch Year</TableCell>
              <TableCell>Batch Verified</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-gray-500">Loading registrations...</p>
                </TableCell>
              </TableRow>
            ) : filteredRegistrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-gray-500">No registrations found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredRegistrations.map((alumni) => (
                <TableRow key={alumni.id} hover>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar src={alumni.profileImage} alt={alumni.name} />
                      <div>
                        <p className="text-sm">{alumni.name}</p>
                        <p className="text-xs text-gray-500">{alumni.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{alumni.department}</TableCell>
                  <TableCell>{alumni.batchYear || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Chip
                        label={alumni.isBatchVerified ? 'Verified' : 'Not Verified'}
                        size="small"
                        color={alumni.isBatchVerified ? 'info' : 'default'}
                        icon={alumni.isBatchVerified ? <Shield className="w-3 h-3" /> : undefined}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={alumni.status}
                      size="small"
                      color={
                        alumni.status === 'Approved' ? 'success' :
                        alumni.status === 'Pending' ? 'warning' : 'error'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-col">
                      <Button
                        size="small"
                        onClick={() => handleView(alumni)}
                        startIcon={<Eye className="w-3 h-3" />}
                        className="w-full"
                      >
                        Review
                      </Button>
                      
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Registration Review</DialogTitle>
        <DialogContent>
          {selectedAlumni && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar
                  src={selectedAlumni.profileImage}
                  alt={selectedAlumni.name}
                  sx={{ width: 80, height: 80 }}
                />
                <div>
                  <h3 className="text-xl">{selectedAlumni.name}</h3>
                  <p className="text-gray-600">{selectedAlumni.email}</p>
                  <Chip
                    label={selectedAlumni.status}
                    size="small"
                    color={
                      selectedAlumni.status === 'Approved' ? 'success' :
                      selectedAlumni.status === 'Pending' ? 'warning' : 'error'
                    }
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm mb-3">Personal Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Phone Number</p>
                    <p className="text-sm">{selectedAlumni.phone || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Email</p>
                    <p className="text-sm">{selectedAlumni.email}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm mb-3">Academic Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Department</p>
                    <p className="text-sm">{selectedAlumni.department || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Program</p>
                    <p className="text-sm">{selectedAlumni.program || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Batch Year</p>
                    <p className="text-sm">{selectedAlumni.batchYear || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Graduation Date</p>
                    <p className="text-sm">{selectedAlumni.graduationDate ? new Date(selectedAlumni.graduationDate).toLocaleDateString() : 'Not specified'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm mb-3">Identity Verification</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div>
                    <p className="text-xs text-gray-600">ID Type</p>
                    <p className="text-sm">{selectedAlumni.idType ? (ID_TYPE_LABELS[selectedAlumni.idType] || selectedAlumni.idType) : 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Uploaded ID</p>
                    {selectedAlumni.idDocumentUrl ? (
                      <a href={selectedAlumni.idDocumentUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={selectedAlumni.idDocumentUrl}
                          alt="Uploaded ID document"
                          className="w-40 h-auto rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ) : (
                      <p className="text-sm text-gray-400">Not provided</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-gray-600">Registration Date</p>
                <p className="text-sm">{selectedAlumni.registeredDate ? new Date(selectedAlumni.registeredDate).toLocaleString() : '-'}</p>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          {selectedAlumni?.status === 'Pending' && (
            <>
              <Button
                color="error"
                startIcon={<XCircle className="w-4 h-4" />}
                onClick={() => selectedAlumni && handleReject(selectedAlumni.id)}
              >
                Reject
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle className="w-4 h-4" />}
                onClick={() => selectedAlumni && handleApprove(selectedAlumni.id)}
              >
                Approve Registration
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
}
