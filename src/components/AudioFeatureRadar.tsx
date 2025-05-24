import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface AudioFeatureRadarProps {
  features: {
    acousticness: number;
    danceability: number;
    energy: number;
    instrumentalness: number;
    liveness: number;
    speechiness: number;
    valence: number;
  };
}

const AudioFeatureRadar: React.FC<AudioFeatureRadarProps> = ({ features }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Clean up any existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: [
          'Danceability',
          'Energy',
          'Acousticness',
          'Instrumentalness',
          'Liveness',
          'Speechiness',
          'Valence'
        ],
        datasets: [
          {
            label: 'Audio Features',
            data: [
              features.danceability,
              features.energy,
              features.acousticness,
              features.instrumentalness,
              features.liveness,
              features.speechiness,
              features.valence
            ],
            backgroundColor: 'rgba(30, 215, 96, 0.2)',
            borderColor: 'rgb(30, 215, 96)',
            pointBackgroundColor: 'rgb(30, 215, 96)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgb(30, 215, 96)'
          }
        ]
      },
      options: {
        scales: {
          r: {
            angleLines: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            pointLabels: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                size: 10
              }
            },
            ticks: {
              backdropColor: 'transparent',
              color: 'rgba(255, 255, 255, 0.5)',
              stepSize: 0.2,
              showLabelBackdrop: false,
              font: {
                size: 8
              }
            },
            suggestedMin: 0,
            suggestedMax: 1
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw as number;
                return `${context.label}: ${Math.round(value * 100)}%`;
              }
            }
          }
        },
        maintainAspectRatio: false
      }
    });

    // Clean up when component unmounts
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [features]);

  return (
    <div className="bg-gray-800/30 p-5 rounded-lg">
      <h3 className="text-xl font-bold mb-4">Audio Profile</h3>
      <div className="w-full h-64">
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
};

export default AudioFeatureRadar; 