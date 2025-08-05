import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AudioLines,
  GalleryVertical as Gallery,
  BarChart3,
  Users,
  AlertTriangle,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

// Component for individual nav items
type NavItemType = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavItemProps = {
  item: NavItemType;
  isActive: boolean;
  onClick?: () => void;
};

const NavItem: React.FC<NavItemProps> = ({ item, isActive, onClick }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
        isActive
          ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30"
          : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
};

type ThemeToggleProps = {
  isDark: boolean;
  toggleTheme: () => void;
};

// Theme toggle component
const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDark, toggleTheme }) => (
  <button
    onClick={toggleTheme}
    className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
    aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
  >
    {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
  </button>
);

type UserProfileProps = {
  profile: { email?: string } | null;
  isAdmin: boolean;
};

// User profile component
const UserProfile: React.FC<UserProfileProps> = ({ profile, isAdmin }) => (
  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 truncate max-w-[160px]">
    <div className="bg-gray-200 border-2 border-dashed rounded-xl w-8 h-8" />
    <div className="flex flex-col truncate">
      <span className="font-medium truncate">{profile?.email}</span>
      {isAdmin && (
        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs mt-0.5">
          Admin
        </span>
      )}
    </div>
  </div>
);

// Mobile menu component
type MobileMenuProps = {
  isOpen: boolean;
  items: NavItemType[];
  toggleTheme: () => void;
  isDark: boolean;
  profile: { email?: string } | null;
  isAdmin: boolean;
  handleSignOut: () => void;
  closeMenu: () => void;
};

const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  items,
  toggleTheme,
  isDark,
  profile,
  isAdmin,
  handleSignOut,
  closeMenu,
}) => {
  const location = useLocation();
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-2 py-3 space-y-1">
            {items.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                isActive={location.pathname === item.path}
                onClick={closeMenu}
              />
            ))}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
              <div className="flex items-center justify-between px-3 py-2">
                <UserProfile profile={profile} isAdmin={isAdmin} />
                <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />
              </div>

              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function Navbar() {
  const { user, profile, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
    setIsDark(initialTheme === "dark");
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = !isDark ? "dark" : "light";
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", newTheme);
  }, [isDark]);

  const handleSignOut = useCallback(async () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      await signOut();
      navigate("/login");
    }
  }, [signOut, navigate]);

  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const toggleMobileMenu = useCallback(
    () => setIsMobileMenuOpen((prev) => !prev),
    []
  );

  const publicNavItems = [
    { path: "/", label: "Analyze", icon: AudioLines },
    { path: "/gallery", label: "Gallery", icon: Gallery },
  ];

  const adminNavItems = [
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { path: "/moderation", label: "Moderation", icon: AlertTriangle },
    { path: "/errors", label: "Errors", icon: AlertTriangle },
    { path: "/admin/users", label: "Users", icon: Users },
  ];

  const allNavItems = [...publicNavItems, ...(isAdmin ? adminNavItems : [])];

  if (!user) return null;

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              aria-label="Go to homepage"
            >
              <AudioLines className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Toxicity Detector
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {allNavItems.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                isActive={location.pathname === item.path}
              />
            ))}
          </div>

          {/* Desktop Right Side */}
          <div className="hidden md:flex items-center space-x-3">
            <ThemeToggle isDark={isDark} toggleTheme={toggleTheme} />

            <div className="flex items-center space-x-4">
              <UserProfile profile={profile} isAdmin={isAdmin} />

              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMobileMenu}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      <MobileMenu
        isOpen={isMobileMenuOpen}
        items={allNavItems}
        toggleTheme={toggleTheme}
        isDark={isDark}
        profile={profile}
        isAdmin={isAdmin}
        handleSignOut={handleSignOut}
        closeMenu={closeMobileMenu}
      />
    </nav>
  );
}
