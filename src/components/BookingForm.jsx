import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, User, CreditCard, Phone, Mail, AlertCircle, CheckCircle, Loader } from 'lucide-react';

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

const AVAILABLE_TIMES = ['15:00', '15:30', '19:45', '20:15'];
const WORK_DAYS = [1, 2, 3, 4]; // Lunes a Jueves

const N8N_ENDPOINTS = {
  CHECK_PATIENT: 'https://n8n-automation.chilldigital.tech/webhook/check-patient',
  CREATE_APPOINTMENT: 'https://n8n-automation.chilldigital.tech/webhook/create-appointment',
  GET_AVAILABILITY: 'https://n8n-automation.chilldigital.tech/webhook/get-availability'
};

export default function BookingForm() {
  // Form state
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

  // UI state
  const [loading, setLoading] = useState(false);
  const [checkingPatient, setCheckingPatient] = useState(false);
  const [patientFound, setPatientFound] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Check patient by DNI
  const checkPatient = async (dni) => {
    if (dni.length < 7) return;
    
    setCheckingPatient(true);
    try {
      const response = await fetch(`${N8N_ENDPOINTS.CHECK_PATIENT}?dni=${dni}`);
      const data = await response.json();
      
      if (data.found) {
        setFormData(prev => ({
          ...prev,
          nombre: data.patient.nombre || '',
          telefono: data.patient.telefono || '',
          obraSocial: data.patient.obraSocial || '',
          numeroAfiliado: data.patient.numeroAfiliado || '',
          alergias: data.patient.alergias || '',
          antecedentes: data.patient.antecedentes || ''
        }));
        setPatientFound(true);
      } else {
        setPatientFound(false);
      }
    } catch (err) {
      console.error('Error checking patient:', err);
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
        `${N8N_ENDPOINTS.GET_AVAILABILITY}?fecha=${fecha}&duration=${appointmentType.duration}`
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
      
      const response = await fetch(N8N_ENDPOINTS.CREATE_APPOINTMENT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          duracion: appointmentType.duration,
          tipoTurnoNombre: appointmentType.name,
          isNewPatient: !patientFound
        })
      });

      if (!response.ok) {
        throw new Error('Error al crear el turno');
      }

      const result = await response.json();
      setSuccess(true);
    } catch (err) {
      setError('Error al crear el turno. Intenta nuevamente.');
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
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">¡Turno Confirmado!</h2>
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
            Agendar Otro Turno
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-blue-600 p-6 text-white text-center">
          <h1 className="text-3xl font-bold mb-2">Agendar Turno</h1>
          <p className="text-teal-100">Completa los datos para reservar tu cita</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* DNI Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CreditCard className="inline w-4 h-4 mr-1" />
              DNI
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.dni}
                onChange={(e) => handleInputChange('dni', e.target.value)}
                placeholder="12.345.678"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
              {checkingPatient && (
                <Loader className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
              )}
            </div>
            {patientFound && (
              <p className="text-green-600 text-sm mt-1 flex items-center gap-1">
                <CheckCircle size={16} />
                Paciente encontrado - datos completados automáticamente
              </p>
            )}
          </div>

          {/* Personal Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline w-4 h-4 mr-1" />
                Nombre Completo
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleInputChange('nombre', e.target.value)}
                placeholder="Juan Pérez"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="inline w-4 h-4 mr-1" />
                Teléfono
              </label>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => handleInputChange('telefono', e.target.value)}
                placeholder="+54 381 123 4567"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Insurance Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Obra Social
              </label>
              <input
                type="text"
                value={formData.obraSocial}
                onChange={(e) => handleInputChange('obraSocial', e.target.value)}
                placeholder="OSDE, Swiss Medical, etc."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                N° de Afiliado
              </label>
              <input
                type="text"
                value={formData.numeroAfiliado}
                onChange={(e) => handleInputChange('numeroAfiliado', e.target.value)}
                placeholder="123456789"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Medical Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alergias
              </label>
              <input
                type="text"
                value={formData.alergias}
                onChange={(e) => handleInputChange('alergias', e.target.value)}
                placeholder="Ninguna, Penicilina, etc."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Antecedentes
              </label>
              <input
                type="text"
                value={formData.antecedentes}
                onChange={(e) => handleInputChange('antecedentes', e.target.value)}
                placeholder="Diabetes, Hipertensión, etc."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Appointment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="inline w-4 h-4 mr-1" />
              Tipo de Turno
            </label>
            <select
              value={formData.tipoTurno}
              onChange={(e) => handleInputChange('tipoTurno', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              required
            >
              <option value="">Selecciona el tipo de consulta</option>
              {APPOINTMENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.duration} min)
                </option>
              ))}
            </select>
          </div>

          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Fecha
            </label>
            <select
              value={formData.fecha}
              onChange={(e) => handleInputChange('fecha', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              required
            >
              <option value="">Selecciona una fecha</option>
              {availableDates.map((date) => (
                <option key={date.value} value={date.value}>
                  {date.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Selection */}
          {formData.fecha && formData.tipoTurno && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                Horario Disponible
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
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={!isFormValid() || loading}
              className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-3 px-6 rounded-lg font-medium text-lg hover:from-teal-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Creando Turno...
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5" />
                  Confirmar Turno
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}