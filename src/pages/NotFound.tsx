import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => (
  <div className="min-h-screen bg-sun-bg flex flex-col items-center justify-center px-6 text-center gap-4">
    <p className="text-6xl font-bold text-sun-accent">404</p>
    <h1 className="text-2xl font-bold">This page doesn't exist</h1>
    <Link to="/" className="sun-button">Back home</Link>
  </div>
);

export default NotFound;
