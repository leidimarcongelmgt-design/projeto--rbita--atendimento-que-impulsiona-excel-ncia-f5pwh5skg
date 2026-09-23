import React from 'react'
import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F8] text-[#1A1A1A]">
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="app-footer border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-[1100px] mx-auto px-4">
          Proibida a reprodução total ou parcial sem autorização.
        </div>
      </footer>
    </div>
  )
}
