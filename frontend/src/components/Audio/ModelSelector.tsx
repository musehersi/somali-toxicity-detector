import React from 'react'
import { Brain, Layers } from 'lucide-react'
import { motion } from 'framer-motion'

interface ModelSelectorProps {
  selectedModel: 'asr_classification' | 'end_to_end' | null
  onModelSelect: (model: 'asr_classification' | 'end_to_end') => void
}

export default function ModelSelector({ selectedModel, onModelSelect }: ModelSelectorProps) {
  const models = [
    {
      id: 'asr_classification' as const,
      name: 'Cascaded ASR + Classification',
      description: 'Converts speech to text, then classifies using XLM-RoBERTa',
      icon: Layers,
      features: ['Speech-to-Text transcription', 'Text-based toxicity detection', 'Multilingual support'],
      latency: '~2-3s',
      accuracy: 'High for clear speech'
    },
    {
      id: 'end_to_end' as const,
      name: 'End-to-End Audio Classifier',
      description: 'Direct audio classification using Wav2Vec2-based model',
      icon: Brain,
      features: ['Direct audio analysis', 'Robust to noise', 'Language-agnostic'],
      latency: '~1-2s',
      accuracy: 'High for various audio quality'
    }
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Select Detection Model
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose the analysis approach that best fits your needs
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {models.map((model) => {
          const Icon = model.icon
          const isSelected = selectedModel === model.id
          
          return (
            <motion.button
              key={model.id}
              onClick={() => onModelSelect(model.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`text-left p-6 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-lg ${
                  isSelected 
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-600' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  <Icon className="h-6 w-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold ${
                    isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'
                  }`}>
                    {model.name}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {model.description}
                  </p>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className={isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'}>
                        Latency: {model.latency}
                      </span>
                      <span className={isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'}>
                        {model.accuracy}
                      </span>
                    </div>
                    
                    <ul className="space-y-1">
                      {model.features.map((feature, index) => (
                        <li key={index} className={`text-xs flex items-center ${
                          isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'
                        }`}>
                          <div className={`w-1 h-1 rounded-full mr-2 ${
                            isSelected ? 'bg-blue-500' : 'bg-gray-400'
                          }`} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}