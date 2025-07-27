import React from 'react';
import { motion } from 'framer-motion';
import { X, Zap, Lightbulb, Eye, Hand, Volume2, SkipForward, SkipBack, Heart, Shuffle, Music } from 'lucide-react';

interface GestureTutorialModalProps {
  onClose: () => void;
}

const gestures = [
  { 
    name: 'Play Music', 
    gesture: 'Open Palm', 
    icon: <Hand className="w-5 h-5" />,
    description: 'Show your open palm to start playing'
  },
  { 
    name: 'Pause Music', 
    gesture: 'Closed Fist', 
    icon: <Hand className="w-5 h-5" />,
    description: 'Make a fist to pause the music'
  },
  { 
    name: 'Next Track', 
    gesture: 'Swipe Right', 
    icon: <SkipForward className="w-5 h-5" />,
    description: 'Move your hand to the right'
  },
  { 
    name: 'Previous Track', 
    gesture: 'Swipe Left', 
    icon: <SkipBack className="w-5 h-5" />,
    description: 'Move your hand to the left'
  },
  { 
    name: 'Volume Up', 
    gesture: 'Swipe Up', 
    icon: <Volume2 className="w-5 h-5" />,
    description: 'Move your hand upward'
  },
  { 
    name: 'Volume Down', 
    gesture: 'Swipe Down', 
    icon: <Volume2 className="w-5 h-5" />,
    description: 'Move your hand downward'
  },
  { 
    name: 'Like Track', 
    gesture: 'Thumbs Up', 
    icon: <Heart className="w-5 h-5" />,
    description: 'Give a thumbs up gesture'
  },
  { 
    name: 'Dislike Track', 
    gesture: 'Thumbs Down', 
    icon: <Heart className="w-5 h-5" />,
    description: 'Give a thumbs down gesture'
  },
  { 
    name: 'Toggle Shuffle', 
    gesture: 'Peace Sign', 
    icon: <Shuffle className="w-5 h-5" />,
    description: 'Show peace sign (✌️)'
  },
  { 
    name: 'Get Recommendations', 
    gesture: 'Rock Sign', 
    icon: <Music className="w-5 h-5" />,
    description: 'Show rock sign (🤘)'
  },
];

const adaptiveFeatures = [
  {
    title: 'Adaptive Lighting Detection',
    description: 'AI automatically adjusts sensitivity based on your lighting conditions',
    icon: <Lightbulb className="w-5 h-5" />
  },
  {
    title: 'Distance Adaptation',
    description: 'Works whether you\'re close to or far from the camera',
    icon: <Eye className="w-5 h-5" />
  },
  {
    title: 'Smart Gesture Recognition',
    description: 'Uses advanced AI to recognize gestures with high accuracy',
    icon: <Zap className="w-5 h-5" />
  }
];

const GestureTutorialModal: React.FC<GestureTutorialModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2 text-white">Gesture Control Tutorial</h2>
          <p className="text-gray-400">Learn how to control your music with hand gestures using our adaptive AI system.</p>
        </div>

        {/* Adaptive AI Features */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-400" />
            Adaptive AI Features
          </h3>
          <div className="grid gap-3">
            {adaptiveFeatures.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 bg-gray-700/50 p-3 rounded-lg">
                <div className="text-green-400 mt-0.5">{feature.icon}</div>
                <div>
                  <h4 className="font-medium text-white">{feature.title}</h4>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gesture Instructions */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-white">Available Gestures</h3>
          <div className="grid gap-3">
            {gestures.map((item, index) => (
              <motion.div 
                key={item.name} 
                className="flex items-center gap-4 bg-gray-700/50 p-4 rounded-lg hover:bg-gray-700/70 transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="text-green-400">{item.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">{item.name}</span>
                    <span className="text-green-400 font-mono text-sm">{item.gesture}</span>
                  </div>
                  <p className="text-sm text-gray-400">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/20">
          <h4 className="font-semibold text-blue-400 mb-2">💡 Tips for Best Results</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Ensure your hand is clearly visible in the camera</li>
            <li>• Make gestures slowly and deliberately</li>
            <li>• The AI adapts to different lighting conditions automatically</li>
            <li>• Works at various distances from the camera</li>
            <li>• Use the sensitivity slider to adjust gesture responsiveness</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
};

export default GestureTutorialModal;
