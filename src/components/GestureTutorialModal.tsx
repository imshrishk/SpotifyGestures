import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface GestureTutorialModalProps {
  onClose: () => void;
}

const gestures = [
  { name: 'Play/Pause', gesture: 'Palm' },
  { name: 'Next Track', gesture: 'Swipe Right' },
  { name: 'Previous Track', gesture: 'Swipe Left' },
  { name: 'Volume Up', gesture: 'Thumbs Up' },
  { name: 'Volume Down', gesture: 'Thumbs Down' },
];

const GestureTutorialModal: React.FC<GestureTutorialModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-800 rounded-lg p-8 max-w-lg w-full relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X />
        </button>
        <h2 className="text-2xl font-bold mb-4">Gesture Controls</h2>
        <p className="text-gray-400 mb-6">Perform these gestures in front of your camera to control your music.</p>
        <div className="space-y-4">
          {gestures.map((item) => (
            <div key={item.name} className="flex justify-between items-center bg-gray-700 p-4 rounded-lg">
              <span className="font-semibold">{item.name}</span>
              <span className="text-green-400 font-mono">{item.gesture}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default GestureTutorialModal;
