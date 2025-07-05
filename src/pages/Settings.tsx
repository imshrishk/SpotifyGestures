import React, { useState, useEffect } from 'react';

const Settings: React.FC = () => {
  const [gestureSettings, setGestureSettings] = useState({});

  useEffect(() => {
    const savedSettings = localStorage.getItem('gesture_settings');
    if (savedSettings) {
      setGestureSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleGestureChange = (action: string, gesture: string) => {
    const newSettings = { ...gestureSettings, [action]: gesture };
    setGestureSettings(newSettings);
    localStorage.setItem('gesture_settings', JSON.stringify(newSettings));
  };

  const actions = ['Play/Pause', 'Next Track', 'Previous Track', 'Volume Up', 'Volume Down'];
  const availableGestures = ['Palm', 'Swipe Right', 'Swipe Left', 'Thumbs Up', 'Thumbs Down'];

  return (
    <div className="p-8 text-white">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Customize Gestures</h2>
        <div className="space-y-4">
          {actions.map((action) => (
            <div key={action} className="flex justify-between items-center">
              <span>{action}</span>
              <select
                value={gestureSettings[action] || ''}
                onChange={(e) => handleGestureChange(action, e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-md p-2"
              >
                <option value="">Default</option>
                {availableGestures.map((gesture) => (
                  <option key={gesture} value={gesture}>{gesture}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;
