import { NavLink } from "react-router-dom";
import { Mail, LayoutDashboard, Play, LogIn } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/mails", label: "Mails", icon: Mail },
  { to: "/session", label: "Session", icon: Play },
];

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-indigo-600" />
            <span className="text-lg font-bold text-gray-900">
              IA Mail Gestion
            </span>
          </div>

          <div className="flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}

            <a
              href="/api/auth/login"
              className="flex items-center gap-2 ml-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Connexion Gmail
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
