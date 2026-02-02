import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

export const ImageGallery = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const thumbnailContainerRef = useRef(null);
  const uniqueImages = [...new Set(images)];

  const handlePrevImage = () => {
    setSelectedImage((prev) => 
      prev === 0 ? uniqueImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setSelectedImage((prev) => 
      prev === uniqueImages.length - 1 ? 0 : prev + 1
    );
  };

  const scrollThumbnails = (direction) => {
    if (thumbnailContainerRef.current) {
      const scrollAmount = direction * (thumbnailContainerRef.current.offsetWidth / 2);
      thumbnailContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full z-10"
        >
          <Minimize2 size={24} />
        </button>
        
        <button
          onClick={handlePrevImage}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full z-10"
        >
          <ChevronLeft size={24} />
        </button>

        <img
          src={uniqueImages[selectedImage]}
          alt="Full screen view"
          className="max-h-screen max-w-full object-contain"
        />

        <button
          onClick={handleNextImage}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full z-10"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full">
      {/* Main Image */}
      <div className="relative w-full aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden mx-auto">
        <img
          src={uniqueImages[selectedImage]}
          alt={`Property view ${selectedImage + 1}`}
          className="w-full h-full object-cover"
        />
        
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <button
            onClick={handlePrevImage}
            className="bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextImage}
            className="bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          onClick={() => setIsFullscreen(true)}
          className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
        >
          <Maximize2 size={16} />
        </button>

        <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-0.5 rounded-full text-xs">
          {selectedImage + 1} / {uniqueImages.length}
        </div>
      </div>

      {/* Thumbnails Slider */}
      <div className="relative mt-2 w-full mx-auto">
        {/* Left Scroll Button */}
        <button
          onClick={() => scrollThumbnails(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
          aria-label="Scroll thumbnails left"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Thumbnails Container */}
        <div 
          ref={thumbnailContainerRef}
          className="flex gap-2 overflow-x-auto px-8 py-2 scrollbar-hide scroll-smooth"
        >
          {uniqueImages.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedImage(index)}
              className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden transition-all
                ${selectedImage === index ? 'ring-2 ring-blue-500 scale-105' : 'ring-1 ring-gray-200 opacity-70'}`}
            >
              <img
                src={image}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scrollThumbnails(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
          aria-label="Scroll thumbnails right"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};