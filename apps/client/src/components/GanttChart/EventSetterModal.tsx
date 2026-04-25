import { useState } from 'react';
import { X, Calendar, Target, Sparkles } from 'lucide-react';
import { useAppStore, EventType, CulminatingEvent } from '../../stores/appStore';
import { format } from 'date-fns';

interface EventSetterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const eventTypes: { id: EventType; name: string; nameEn: string; icon: string }[] = [
  { id: 'concert', name: 'Concierto', nameEn: 'Concert', icon: '🎵' },
  { id: 'launch', name: 'Lanzamiento', nameEn: 'Launch', icon: '🚀' },
  { id: 'exam', name: 'Examen', nameEn: 'Exam', icon: '📝' },
  { id: 'presentation', name: 'Presentación', nameEn: 'Presentation', icon: '🎤' },
  { id: 'retreat', name: 'Retiro', nameEn: 'Retreat', icon: '🏕️' },
  { id: 'deadline', name: 'Fecha límite', nameEn: 'Deadline', icon: '⏰' },
  { id: 'custom', name: 'Personalizado', nameEn: 'Custom', icon: '⭐' },
];

export function EventSetterModal({ isOpen, onClose }: EventSetterModalProps) {
  const { language, culminatingEvent, setCulminatingEvent, ganttConfig } = useAppStore();

  const [name, setName] = useState(culminatingEvent?.name || '');
  const [nameEn, setNameEn] = useState(culminatingEvent?.nameEn || '');
  const [date, setDate] = useState(
    culminatingEvent?.date
      ? format(new Date(culminatingEvent.date), 'yyyy-MM-dd')
      : format(ganttConfig.endDate, 'yyyy-MM-dd')
  );
  const [type, setType] = useState<EventType>(culminatingEvent?.type || 'custom');
  const [description, setDescription] = useState(culminatingEvent?.description || '');
  const [descriptionEn, setDescriptionEn] = useState(culminatingEvent?.descriptionEn || '');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim() || !date) return;

    const event: CulminatingEvent = {
      id: culminatingEvent?.id || `event-${Date.now()}`,
      name: name.trim(),
      nameEn: nameEn.trim() || name.trim(),
      date: new Date(date),
      type,
      description: description.trim() || undefined,
      descriptionEn: descriptionEn.trim() || description.trim() || undefined,
    };

    setCulminatingEvent(event);
    onClose();
  };

  const handleRemove = () => {
    setCulminatingEvent(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={language === 'es' ? 'Cerrar modal' : 'Close modal'}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default appearance-none border-0 p-0"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={24} />
              <h2 className="text-xl font-bold">
                {language === 'es' ? 'Evento Culminante' : 'Culminating Event'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-white/80 mt-1">
            {language === 'es'
              ? 'El momento hacia el cual todo converge'
              : 'The moment everything converges toward'}
          </p>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'es' ? 'Tipo de evento' : 'Event type'}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {eventTypes.map((eventType) => (
                <button
                  key={eventType.id}
                  onClick={() => setType(eventType.id)}
                  className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all ${
                    type === eventType.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{eventType.icon}</span>
                  <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                    {language === 'es' ? eventType.name : eventType.nameEn}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Event Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {language === 'es' ? 'Nombre del evento' : 'Event name'}
            </label>
            <input
              type="text"
              value={language === 'es' ? name : nameEn || name}
              onChange={(e) => language === 'es' ? setName(e.target.value) : setNameEn(e.target.value)}
              placeholder={language === 'es' ? 'Ej: Concierto de Primavera' : 'E.g.: Spring Concert'}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {language === 'es' && (
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="English name (optional)"
                className="w-full mt-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Calendar size={14} className="inline mr-1" />
              {language === 'es' ? 'Fecha' : 'Date'}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {language === 'es' ? 'Descripción (opcional)' : 'Description (optional)'}
            </label>
            <textarea
              value={language === 'es' ? description : descriptionEn || description}
              onChange={(e) => language === 'es' ? setDescription(e.target.value) : setDescriptionEn(e.target.value)}
              rows={2}
              placeholder={language === 'es' ? 'Agrega contexto sobre el evento...' : 'Add context about the event...'}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          {culminatingEvent ? (
            <button
              onClick={handleRemove}
              className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
            >
              {language === 'es' ? 'Eliminar evento' : 'Remove event'}
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !date}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={16} />
              {language === 'es' ? 'Guardar' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
