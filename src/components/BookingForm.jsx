import React, { useMemo, useRef, useState } from 'react';
import { Calendar, Clock, User, CreditCard, Phone, AlertCircle, CheckCircle, Loader } from 'lucide-react';

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

const BASE_URL = (process.env.REACT_APP_N8N_BASE_URL || 'https://n8n-automation.chilldigital.tech').replace(/\/+$/, '');
const N8N_ENDPOINTS = {
  CHECK_PATIENT: `${BASE_URL}/webhook/check-patient`,
  CREATE_APPOINTMENT: `${BASE_URL}/webhook/create-appointment`,
  GET_AVAILABILITY: `${BASE_URL}/webhook/get-availability`
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function toLocalISOStringWithOffset(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const tzo = -date.getTimezoneOffset();
  const sign = tzo >= 0 ? '+' : '-';
  const hh = pad(Math.floor(Math.abs(tzo) / 60));
  const mm = pad(Math.abs(tzo) % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${hh}:${mm}`
  );
}

export default function BookingForm() {
  const [formData, setFormData] = useState({
    dni: '',
    nombre: '',
    telefono: '',
    obraSocial: '',
    numeroAfiliado: '',
    alergias: '',
    antecedentes: '',
    tipoTurno: '',
    fecha: '',
    hora: ''
  });

  const [loading, setLoading] = useState(false);
  const [checkingPatient, setCheckingPatient] = useState(false);
  const [patientFound, setPatientFound] = useState(false);
  const [patientSearched, setPatientSearched] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const dniDebounceRef = useRef(null);

  const checkPatient = async (dni) => {
    if (dni.length < 8) {
      setPatientFound(false);
      setPatientSearched(false);
      return;
    }

    setCheckingPatient(true);
    setError('');

    try {
      const response = await fetchWithTimeout(`${N8N_ENDPOINTS.CHECK_PATIENT}?dni=${dni}`, {}, 10000);
      if (!response.ok) throw new Error('Error al consultar paciente');
      const data = await response.json();

      if (data.found && data.patient) {
        setFormData(prev => ({
          ...prev,
          nombre: data.patient.nombre || data.patient.name || '',
          telefono: data.patient.telefono || data.patient.phone || '',
          obraSocial: data.patient.obraSocial || data.patient.insurance || '',
          numeroAfiliado: data.patient.numeroAfiliado || data.patient.affiliateNumber || '',
          alergias: data.patient.alergias || data.patient.allergies || 'Ninguna',
          antecedentes: data.patient.antecedentes || data.patient.background || 'Ninguno'
        }));
        setPatientFound(true);
      } else {
        setPatientFound(false);
      }
      setPatientSearched(true);
    } catch (err) {
      console.error('Error checking patient:', err);
      setError('Error al verificar el paciente. Intenta nuevamente.');
      setPatientFound(false);
      setPatientSearched(true);
    } finally {
      setCheckingPatient(false);
    }
  };

  const getAvailableSlots = async (fecha, tipoTurno) => {
    if (!fecha || !tipoTurno) return;

    setLoadingAvailability(true);
    try {
      const appointmentType = APPOINTMENT_TYPES.find(t => t.id === tipoTurno);
      const response = await fetchWithTimeout(
        `${N8N_ENDPOINTS.GET_AVAILABILITY}?fecha=${fecha}&duration=${appointmentType.duration}`,
        {},
        10000
      );
      if (!response.ok) throw new Error('Error al consultar disponibilidad');
      const data = await response.json();
      setAvailableSlots(data.availableSlots || []);
    } catch (err) {
      console.error('Error getting availability:', err);
      setAvailableSlots([]);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (WORK_DAYS.includes(d.getDay())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const value = `${y}-${m}-${day}`;
        const label = d.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        dates.push({ value, label });
      }
    }
    return dates;
  }, []);

  const handleInputChange = (field, rawValue) => {
    let value = rawValue;

    if (field === 'dni') value = (rawValue || '').replace(/\D/g, '');
    if (field === 'telefono') value = (rawValue || '').replace(/[ .-]/g, '');

    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'dni') {
      if (dniDebounceRef.current) clearTimeout(dniDebounceRef.current);
      if (value && value.length >= 8) {
        dniDebounceRef.current = setTimeout(() => checkPatient(value), 400);
      } else {
        setPatientFound(false);
        setPatientSearched(false);
      }
    }

    if (field === 'fecha' || field === 'tipoTurno') {
      const newFormData = { ...formData, [field]: value };
      if (newFormData.fecha && newFormData.tipoTurno) {
        getAvailableSlots(newFormData.fecha, newFormData.tipoTurno);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const appointmentType = APPOINTMENT_TYPES.find(t => t.id === formData.tipoTurno);
      const [hours, minutes] = formData.hora.split(':');
      const appointmentDateTime = new Date(formData.fecha);
      appointmentDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      const appointmentISO = toLocalISOStringWithOffset(appointmentDateTime);

      const response = await fetchWithTimeout(N8N_ENDPOINTS.CREATE_APPOINTMENT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: formData.dni,
          nombre: formData.nombre,
          telefono: formData.telefono,
          obraSocial: formData.obraSocial,
          numeroAfiliado: formData.numeroAfiliado,
          alergias: formData.alergias || 'Ninguna',
          antecedentes: formData.antecedentes || 'Ninguno',
          tipoTurno: formData.tipoTurno,
          tipoTurnoNombre: appointmentType.name,
          duracion: appointmentType.duration,
          fechaHora: appointmentISO,
          timezone: 'America/Argentina/Buenos_Aires',
          isNewPatient: !patientFound
        })
      }, 15000);

      if (!response.ok) {
        let msg = 'Error al crear el turno';
        try {
          const errorData = await response.json();
          msg = errorData.message || msg;
        } catch (_) {}
        throw new Error(msg);
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

  const isFormValid = () => {
    const dniOk = formData.dni && formData.dni.length >= 8;
    const telOk = formData.telefono && formData.telefono.replace(/\D/g, '').length >= 8;
    return dniOk && formData.nombre && telOk && formData.tipoTurno && formData.fecha && formData.hora;
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">¡Turno confirmado!</h2>
          <p className="text-gray-600 mb-6">
            Tu turno ha sido agendado exitosamente. Recibirás un recordatorio por WhatsApp un día antes.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha:</span>
              <span className="font-medium">{availableDates.find(d => d.value === formData.fecha)?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Hora:</span>
              <span className="font-medium">{formData.hora} hs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tipo:</span>
              <span className="font-medium">{APPOINTMENT_TYPES.find(t => t.id === formData.tipoTurno)?.name}</span>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors"
          >
            Agendar otro turno
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-blue-600 p-6 text-white text-center">
          <h1 className="text-3xl font-bold mb-2">Agendar turno</h1>
          <p className="text-teal-100">Completá los datos para reservar tu cita</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6" aria-busy={loading}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2" role="alert" aria-live="polite">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          <div>
            <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-2">
              <CreditCard className="inline w-4 h-4 mr-1" />
              DNI
            </label>
            <div className="relative">
              <input
                id="dni"
                type="text"
                value={formData.dni}
                onChange={(e) => handleInputChange('dni', e.target.value)}
                placeholder="Ej: 12345678"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
                inputMode="numeric"
                aria-describedby="dni-help"
              />
              {checkingPatient && (
                <Loader className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" aria-label="Buscando paciente" />
              )}
            </div>
            {patientFound && (
              <p className="text-green-600 text-sm mt-1 flex items-center gap-1" aria-live="polite">
                <CheckCircle size={16} />
                Paciente encontrado. Datos completados automáticamente.
              </p>
            )}
            {patientSearched && !patientFound && !checkingPatient && formData.dni.length >= 8 && (
              <p id="dni-help" className="text-gray-600 text-sm mt-1">
                Paciente no encontrado. Podés continuar como paciente nuevo.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline w-4 h-4 mr-1" />
                Nombre completo
              </label>
              <input
                id="nombre"
                type="text"
                value={formData.nombre}
                onChange={(e) => handleInputChange('nombre', e.target.value)}
                placeholder="Juan Pérez"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="inline w-4 h-4 mr-1" />
                Teléfono
              </label>
              <input
                id="telefono"
                type="tel"
                value={formData.telefono}
                onChange={(e) => handleInputChange('telefono', e.target.value)}
                placeholder="Ej: +54 3811234567"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="obraSocial" className="block text-sm font-medium text-gray-700 mb-2">
                Obra social
              </label>
              <input
                id="obraSocial"
                type="text"
                value={formData.obraSocial}
                onChange={(e) => handleInputChange('obraSocial', e.target.value)}
                placeholder="OSDE, Swiss Medical, etc."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="numeroAfiliado" className="block text-sm font-medium text-gray-700 mb-2">
                N° de afiliado
              </label>
              <input
                id="numeroAfiliado"
                type="text"
                value={formData.numeroAfiliado}
                onChange={(e) => handleInputChange('numeroAfiliado', e.target.value)}
                placeholder="123456789"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="alergias" className="block text-sm font-medium text-gray-700 mb-2">
                Alergias
              </label>
              <input
                id="alergias"
                type="text"
                value={formData.alergias}
                onChange={(e) => handleInputChange('alergias', e.target.value)}
                placeholder="Ninguna, Penicilina, etc."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="antecedentes" className="block text-sm font-medium text-gray-700 mb-2">
                Antecedentes
              </label>
              <input
                id="antecedentes"
                type="text"
                value={formData.antecedentes}
                onChange={(e) => handleInputChange('antecedentes', e.target.value)}
                placeholder="Diabetes, Hipertensión, etc."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tipoTurno" className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="inline w-4 h-4 mr-1" />
              Tipo de turno
            </label>
            <select
              id="tipoTurno"
              value={formData.tipoTurno}
              onChange={(e) => handleInputChange('tipoTurno', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              required
            >
              <option value="">Seleccioná el tipo de consulta</option>
              {APPOINTMENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.duration} min)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Fecha
            </label>
            <select
              id="fecha"
              value={formData.fecha}
              onChange={(e) => handleInputChange('fecha', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              required
            >
              <option value="">Seleccioná una fecha</option>
              {availableDates.map((date) => (
                <option key={date.value} value={date.value}>
                  {date.label}
                </option>
              ))}
            </select>
          </div>

          {formData.fecha && formData.tipoTurno && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                Horario disponible
              </label>
              {loadingAvailability ? (
                <div className="flex items-center gap-2 p-3 text-gray-600">
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
                      className={`p-3 text-sm rounded-lg border transition-colors ${
                        formData.hora === slot
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-teal-500'
                      }`}
                      aria-pressed={formData.hora === slot}
                    >
                      {slot} hs
                    </button>
                  ))}
                </div>
              )}
              {!loadingAvailability && availableSlots.length === 0 && (
                <p className="text-gray-500 text-sm p-3 bg-gray-50 rounded-lg">
                  No hay horarios disponibles para esta fecha y tipo de turno.
                </p>
              )}
              {formData.fecha && formData.tipoTurno && !formData.hora && availableSlots.length > 0 && (
                <p className="text-gray-600 text-sm mt-2">Seleccioná un horario para continuar.</p>
              )}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={!isFormValid() || loading}
              className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-3 px-6 rounded-lg font-medium text-lg hover:from-teal-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
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
