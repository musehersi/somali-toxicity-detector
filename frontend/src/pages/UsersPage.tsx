import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Loader, Trash2, User, UserPlus, UserCheck, UserX } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

const UsersPage = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setError("Failed to fetch users: " + error.message);
        console.error(error);
      } else {
        setUsers(data as UserProfile[]);
      }
      setLoading(false);
    };

    fetchUsers();

    // Set up real-time subscription
    const subscription = supabase
      .channel("profiles-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setUsers((prev) => [payload.new as UserProfile, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setUsers((prev) =>
              prev.map((user) =>
                user.id === payload.new.id ? (payload.new as UserProfile) : user
              )
            );
          } else if (payload.eventType === "DELETE") {
            setUsers((prev) =>
              prev.filter((user) => user.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateUserRole = async (userId: string, newRole: string) => {
    setUpdating((prev) => ({ ...prev, [userId]: true }));
    setError("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      // Real-time update will handle the UI refresh
    } catch (error: any) {
      setError("Failed to update role: " + error.message);
      console.error(error);
    } finally {
      setUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const deleteUser = async (userId: string) => {
    setDeleting((prev) => ({ ...prev, [userId]: true }));
    setError("");

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      // Real-time update will handle the UI refresh
    } catch (error: any) {
      setError("Failed to delete user: " + error.message);
      console.error(error);
    } finally {
      setDeleting((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <UserCheck className="w-4 h-4 mr-1" />;
      case "user":
        return <User className="w-4 h-4 mr-1" />;
      default:
        return <UserX className="w-4 h-4 mr-1" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          User Management
        </h1>
        <div className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full flex items-center">
          <UserPlus className="w-4 h-4 mr-1" />
          {users.length} {users.length === 1 ? "user" : "users"}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-600 dark:text-gray-400">
          <Loader className="h-5 w-5 animate-spin mr-2" />
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <UserX className="mx-auto h-12 w-12 mb-3" />
          <p className="text-lg">No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          updateUserRole(user.id, e.target.value)
                        }
                        className={`bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm ${
                          updating[user.id] ? "opacity-70" : ""
                        }`}
                        disabled={updating[user.id]}
                      >
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                      </select>
                      <span className="ml-2">
                        {updating[user.id] ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          getRoleIcon(user.role)
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => deleteUser(user.id)}
                      disabled={deleting[user.id]}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 flex items-center justify-end w-full"
                    >
                      {deleting[user.id] ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-1" />
                          <span>Delete</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
