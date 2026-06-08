import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Trash2, ChevronDown } from "lucide-react";
import { authApi } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { usePlayerStore } from "../../store/playerStore";

/** "Security" card for the Profile page: change password + delete account. */
export default function AccountSecurity() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const showToast = usePlayerStore((s) => s.showToast);

  const [openPw, setOpenPw] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");

  const [openDelete, setOpenDelete] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState("");

  const submitPw = async () => {
    setPwError("");
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    setPwBusy(true);
    try {
      await authApi.changePassword(oldPw, newPw);
      showToast("Password changed");
      setOpenPw(false); setOldPw(""); setNewPw("");
    } catch (e: any) {
      setPwError(e?.response?.data?.error || "Couldn't change password.");
    } finally {
      setPwBusy(false);
    }
  };

  const submitDelete = async () => {
    setDelError("");
    setDelBusy(true);
    try {
      await authApi.deleteAccount(delPw);
      logout();
      navigate("/login");
    } catch (e: any) {
      setDelError(e?.response?.data?.error || "Couldn't delete account.");
      setDelBusy(false);
    }
  };

  const input =
    "w-full bg-[#080808] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-[#f5f0e8] placeholder-[#3a3a3a] focus:outline-none focus:border-[#c9a84c] transition-colors";

  return (
    <div className="mb-5 px-4 md:px-8">
      <p className="text-[11px] font-semibold text-[#3a3a3a] uppercase tracking-[0.16em] mb-2 px-1"
         style={{ fontFamily: "Syne, sans-serif" }}>
        Security
      </p>
      <div className="rounded-2xl overflow-hidden" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
        {/* Change password */}
        <button
          onClick={() => setOpenPw((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#1a1a1a] text-left"
        >
          <KeyRound size={15} className="text-[#605850] flex-shrink-0" />
          <span className="flex-1 text-sm text-[#b8b0a0]">Change password</span>
          <ChevronDown size={15} className={`text-[#605850] transition-transform ${openPw ? "rotate-180" : ""}`} />
        </button>
        {openPw && (
          <div className="px-4 py-4 border-b border-[#1a1a1a] flex flex-col gap-2.5">
            <input className={input} type="password" placeholder="Current password (skip if you signed up with Google)"
                   value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
            <input className={input} type="password" placeholder="New password"
                   value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            {pwError && <p className="text-xs text-red-400">{pwError}</p>}
            <button
              onClick={submitPw} disabled={pwBusy}
              className="self-start px-4 py-2 rounded-lg text-xs font-bold text-[#080808] disabled:opacity-60"
              style={{ background: "linear-gradient(180deg,#e8c97a,#c9a84c)", fontFamily: "Syne, sans-serif" }}
            >
              {pwBusy ? "Saving…" : "Update password"}
            </button>
          </div>
        )}

        {/* Delete account */}
        <button
          onClick={() => setOpenDelete((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        >
          <Trash2 size={15} className="text-[#be123c] flex-shrink-0" />
          <span className="flex-1 text-sm text-[#f87171]">Delete account</span>
          <ChevronDown size={15} className={`text-[#605850] transition-transform ${openDelete ? "rotate-180" : ""}`} />
        </button>
        {openDelete && (
          <div className="px-4 py-4 border-t border-[#1a1a1a] flex flex-col gap-2.5">
            <p className="text-xs text-[#605850] leading-relaxed">
              This permanently deletes your account, saved songs, playlists and history. This can't be undone.
            </p>
            <input className={input} type="password" placeholder="Confirm your password"
                   value={delPw} onChange={(e) => setDelPw(e.target.value)} />
            {delError && <p className="text-xs text-red-400">{delError}</p>}
            <button
              onClick={submitDelete} disabled={delBusy}
              className="self-start px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-60"
              style={{ background: "rgba(190,18,60,0.12)", border: "1px solid rgba(190,18,60,0.4)", color: "#f87171", fontFamily: "Syne, sans-serif" }}
            >
              {delBusy ? "Deleting…" : "Permanently delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
