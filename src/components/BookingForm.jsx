import React, { useState, useMemo } from 'react';
import { Calendar, AlertCircle, CheckCircle, Loader, User, Hash, Phone, Building2, Mail, AlertTriangle, ClipboardList, ChevronDown } from 'lucide-react';
import OBRAS_SOCIALES from '../data/obras_sociales.json';

const APPOINTMENT_TYPES = [
  { id: 'consulta', name: 'Consulta', duration: 30 },
  { id: 'limpieza', name: 'Limpieza', duration: 45 },
  { id: 'ensenanza', name: 'Enseñanza de técnica de cepillado y flúor en niños', duration: 30 },
  { id: 'caries_chicos', name: 'Arreglos caries chicos', duration: 45 },
  { id: 'caries_grandes', name: 'Arreglos caries grandes', duration: 60 },
  { id: 'molde_blanqueamiento', name: 'Toma de molde para blanqueamiento ambulatorio', duration: 30 },
  { id: 'molde_relajacion', name: 'Toma de molde para placa de relajación', duration: 30 },
  { id: 'instalacion_placas', name: 'Instalación de placas de relajación', duration: 45 },
  { id: 'carillas', name: 'Carillas anteriores', duration: 90 },
  { id: 'contenciones', name: 'Contenciones', duration: 45 },
  { id: 'incrustaciones', name: 'Incrustaciones', duration: 75 }
];

const WORK_DAYS = [1, 2, 3, 4]; // Lunes a Jueves

const N8N_ENDPOINTS = {
  CHECK_PATIENT: 'https://n8n-automation.chilldigital.tech/webhook/check-patient',
  CREATE_APPOINTMENT: 'https://n8n-automation.chilldigital.tech/webhook/create-appointment',
  GET_AVAILABILITY: 'https://n8n-automation.chilldigital.tech/webhook/get-availability'
};

const API_HEADERS = { 'X-API-KEY': process.env.REACT_APP_API_KEY || '' };

export default function BookingForm() {
  // Form state
  const [formData, setFormData] = useState({
    dni: '',
    nombre: '',
    telefono: '',
    email: '',
    obraSocial: '',
    numeroAfiliado: '',
    alergias: '',
    antecedentes: '',
    tipoTurno: '',
    fecha: '',
    hora: ''
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [checkingPatient, setCheckingPatient] = useState(false);
  const [patientFound, setPatientFound] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // UI helpers
  const inputClass = "w-full h-11 px-4 rounded-2xl bg-zinc-100 border border-transparent placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white focus:border-transparent transition-colors";

  // Opciones de obras sociales ordenadas alfabéticamente
  const obrasSociales = useMemo(
    () => [...OBRAS_SOCIALES].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
    []
  );

  // Check patient by DNI
  const checkPatient = async (dni) => {
    if (dni.length < 8) {
      setPatientFound(false);
      return;
    }
    
    setCheckingPatient(true);
    setError('');
    
    try {
      const response = await fetch(`${N8N_ENDPOINTS.CHECK_PATIENT}?dni=${dni}`, {
        method: 'GET',
        headers: { ...API_HEADERS }
      });
      
      if (!response.ok) {
        throw new Error('Error al consultar paciente');
      }
      
      const data = await response.json();
      
      if (data.found && data.patient) {
        // Autocompletar datos del paciente encontrado
        setFormData(prev => ({
          ...prev,
          nombre: data.patient.nombre || data.patient.name || '',
          telefono: data.patient.telefono || data.patient.phone || '',
          email: data.patient.email || '',
          obraSocial: data.patient.obraSocial || data.patient.insurance || '',
          numeroAfiliado: data.patient.numeroAfiliado || data.patient.affiliateNumber || '',
          alergias: data.patient.alergias || data.patient.allergies || 'Ninguna',
          antecedentes: data.patient.antecedentes || data.patient.background || 'Ninguno'
        }));
        setPatientFound(true);
      } else {
        // Limpiar datos si no se encuentra el paciente
        setFormData(prev => ({
          ...prev,
          nombre: '',
          telefono: '',
          email: '',
          obraSocial: '',
          numeroAfiliado: '',
          alergias: '',
          antecedentes: ''
        }));
        setPatientFound(false);
      }
    } catch (err) {
      console.error('Error checking patient:', err);
      setError('Error al verificar el paciente. Intenta nuevamente.');
      setPatientFound(false);
    } finally {
      setCheckingPatient(false);
    }
  };

  // Get available slots for selected date and appointment type
  const getAvailableSlots = async (fecha, tipoTurno) => {
    if (!fecha || !tipoTurno) return;
    
    setLoadingAvailability(true);
    try {
      const appointmentType = APPOINTMENT_TYPES.find(t => t.id === tipoTurno);
      const response = await fetch(
        `${N8N_ENDPOINTS.GET_AVAILABILITY}?fecha=${fecha}&duration=${appointmentType.duration}`,
        { method: 'GET', headers: { ...API_HEADERS } }
      );
      const data = await response.json();
      setAvailableSlots(data.availableSlots || []);
    } catch (err) {
      console.error('Error getting availability:', err);
      setAvailableSlots([]);
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Generate available dates (next 2 weeks, only work days)
  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      if (WORK_DAYS.includes(date.getDay())) {
        dates.push({
          value: date.toISOString().split('T')[0],
          label: date.toLocaleDateString('es-AR', { 
            weekday: 'long', 
            day: '2-digit', 
            month: 'long' 
          })
        });
      }
    }
    
    return dates;
  }, []);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'dni') {
      checkPatient(value);
    }
    
    if (field === 'fecha' || field === 'tipoTurno') {
      const newFormData = { ...formData, [field]: value };
      if (newFormData.fecha && newFormData.tipoTurno) {
        getAvailableSlots(newFormData.fecha, newFormData.tipoTurno);
      }
    }
  };

  // Submit appointment
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const appointmentType = APPOINTMENT_TYPES.find(t => t.id === formData.tipoTurno);
      
      // Combinar fecha y hora en formato ISO completo
      const [hours, minutes] = formData.hora.split(':');
      const appointmentDateTime = new Date(formData.fecha);
      appointmentDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const appointmentISO = appointmentDateTime.toISOString();
      
      const response = await fetch(N8N_ENDPOINTS.CREATE_APPOINTMENT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...API_HEADERS },
        body: JSON.stringify({
          // Datos del paciente
          dni: formData.dni,
          nombre: formData.nombre,
          telefono: formData.telefono,
          email: formData.email,
          obraSocial: formData.obraSocial,
          numeroAfiliado: formData.numeroAfiliado,
          alergias: formData.alergias || 'Ninguna',
          antecedentes: formData.antecedentes || 'Ninguno',
          // Datos del turno
          tipoTurno: formData.tipoTurno,
          tipoTurnoNombre: appointmentType.name,
          duracion: appointmentType.duration,
          fechaHora: appointmentISO, // Fecha y hora en formato ISO completo
          timezone: 'America/Argentina/Buenos_Aires',
          // Metadatos
          isNewPatient: !patientFound
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al crear el turno');
      }

      await response.json();
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Error al crear el turno. Intenta nuevamente.');
      console.error('Error creating appointment:', err);
    } finally {
      setLoading(false);
    }
  };

  // Validation
  const isFormValid = () => {
    return formData.dni && formData.nombre && formData.telefono && 
           formData.tipoTurno && formData.fecha && formData.hora;
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl border border-zinc-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-teal-600" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">¡Turno confirmado!</h2>
          <p className="text-zinc-600 mb-6">
            Tu turno fue agendado. Te enviaremos un recordatorio por WhatsApp un día antes.
          </p>
          <div className="bg-zinc-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600">Fecha</span>
              <span className="font-medium text-zinc-900">{availableDates.find(d => d.value === formData.fecha)?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Hora</span>
              <span className="font-medium text-zinc-900">{formData.hora} hs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Tipo</span>
              <span className="font-medium text-zinc-900">{APPOINTMENT_TYPES.find(t => t.id === formData.tipoTurno)?.name}</span>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full inline-flex items-center justify-center h-11 px-4 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            Agendar otro turno
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Agendar turno</h1>
          <p className="text-zinc-500 mt-1">Completá los datos para reservar tu cita</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* DNI + Nombre */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2"><Hash className="w-4 h-4 text-zinc-500" /> DNI</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.dni}
                  onChange={(e) => handleInputChange('dni', e.target.value)}
                  placeholder="12.345.678"
                  className={inputClass}
                  required
                />
                {checkingPatient && (
                  <Loader className="absolute right-3 top-3 w-5 h-5 text-zinc-400 animate-spin" />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2"><User className="w-4 h-4 text-zinc-500" /> Nombre completo</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleInputChange('nombre', e.target.value)}
                placeholder="Juan Pérez"
                className={inputClass}
                required
              />
            </div>
          </div>
          {patientFound && (
            <div className="flex items-center gap-1 text-teal-600 text-sm mt-1">
              <CheckCircle size={16} />
              <span>¡Paciente encontrado! Datos completados automáticamente</span>
            </div>
          )}

          {/* Contacto: Teléfono + Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2"><Phone className="w-4 h-4 text-zinc-500" /> Teléfono</label>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => handleInputChange('telefono', e.target.value)}
                placeholder="+54 381 123 4567"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2"><Mail className="w-4 h-4 text-zinc-500" /> Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="nombre@correo.com"
                className={inputClass}
                required
              />
            </div>
          </div>

          {/* Insurance Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2"><Building2 className="w-4 h-4 text-zinc-500" /> Obra social</label>
              <div className="relative">
                <select
                  value={formData.obraSocial}
                  onChange={(e) => handleInputChange('obraSocial', e.target.value)}
                  className={`${inputClass} pr-10 appearance-none ${formData.obraSocial === '' ? 'text-gray-400' : 'text-black'}`}
                >
                  <option value="" className="text-gray-400">Seleccioná obra social</option>
                  {obrasSociales.map((os) => (
                    <option key={os} value={os} className="text-black">{os}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2"><Hash className="w-4 h-4 text-zinc-500" /> N° de afiliado</label>
              <input
                type="text"
                value={formData.numeroAfiliado}
                onChange={(e) => handleInputChange('numeroAfiliado', e.target.value)}
                placeholder="123456789"
                className={inputClass}
              />
            </div>
          </div>

          {/* Medical Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-zinc-500" /> Alergias</label>
              <input
                type="text"
                value={formData.alergias}
                onChange={(e) => handleInputChange('alergias', e.target.value)}
                placeholder="Ninguna, Penicilina, etc."
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-zinc-500" /> Antecedentes</label>
              <input
                type="text"
                value={formData.antecedentes}
                onChange={(e) => handleInputChange('antecedentes', e.target.value)}
                placeholder="Diabetes, Hipertensión, etc."
                className={inputClass}
              />
            </div>
          </div>

          {/* Appointment Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Tipo de turno</label>
            <div className="relative">
              <select
                value={formData.tipoTurno}
                onChange={(e) => handleInputChange('tipoTurno', e.target.value)}
                className={`${inputClass} pr-10 appearance-none ${formData.tipoTurno === '' ? 'text-gray-400' : 'text-black'}`}
                required
              >
                <option value="" className="text-gray-400">Seleccioná el tipo de consulta</option>
                {APPOINTMENT_TYPES.map((type) => (
                  <option key={type.id} value={type.id} className="text-black">
                    {type.name} ({type.duration} min)
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Fecha</label>
            <div className="relative">
              <select
                value={formData.fecha}
                onChange={(e) => handleInputChange('fecha', e.target.value)}
                className={`${inputClass} pr-10 appearance-none ${formData.fecha === '' ? 'text-gray-400' : 'text-black'}`}
                required
              >
                <option value="" className="text-gray-400">Seleccioná una fecha</option>
                {availableDates.map((date) => (
                  <option key={date.value} value={date.value} className="text-black">
                    {date.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            </div>
          </div>

          {/* Time Selection */}
          {formData.fecha && formData.tipoTurno && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Horarios disponibles</label>
              {loadingAvailability ? (
                <div className="flex items-center gap-2 p-3 text-zinc-600">
                  <Loader className="w-5 h-5 animate-spin" />
                  Cargando horarios disponibles...
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleInputChange('hora', slot)}
                      className={`h-10 px-3 text-sm rounded-md border transition-colors ${
                        formData.hora === slot
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                      }`}
                      aria-pressed={formData.hora === slot}
                    >
                      {slot} hs
                    </button>
                  ))}
                </div>
              )}
              {!loadingAvailability && availableSlots.length === 0 && (
                <p className="text-zinc-600 text-sm p-3 bg-zinc-50 rounded-lg">
                  No hay horarios disponibles para esta fecha y tipo de turno.
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormValid() || loading}
              className="w-full inline-flex items-center justify-center h-11 px-4 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Creando turno...
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5" />
                  Confirmar turno
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
