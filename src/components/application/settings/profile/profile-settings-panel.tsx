import { useEffect, useRef, useState } from "react";
import { profileIdentity } from "@/app/profile-identity";
import { useAccountPageNavigation } from "@/components/application/account/account-page-provider";
import { Button } from "@/components/base/buttons/button";
import { ModalBody, ModalFooter } from "@/components/base/modal/modal";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { useSettingsOpener } from "../settings-opener";
import { ProfileAccountCard } from "./profile-account-card";
import { ProfileActivityCard } from "./profile-activity-card";
import { ProfileEditForm } from "./profile-edit-form";
import { ProfileHeader } from "./profile-header";

/**
 * 个人资料: who you are (identity card), your NekoPapa account, and how you
 * use NekoPapa on this device. Editing swaps the overview for the local
 * profile form and returns to it on save or cancel.
 */
export function ProfileSettingsPanel({ onClose }: { onClose: () => void }) {
  const { profile } = useLocalProfile();
  const openAccountPage = useAccountPageNavigation();
  const settingsOpener = useSettingsOpener();
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const returning = useRef(false);

  // Back from the form, focus the control that opened it.
  useEffect(() => {
    if (editing || !returning.current) return;
    returning.current = false;
    editButton.current?.focus();
  }, [editing]);

  // The login page is its own application page: leave settings, and when the
  // page is closed return focus to whatever opened settings.
  const openLogin = () => {
    const target = settingsOpener();
    onClose();
    openAccountPage.open(target);
  };

  if (editing) return <ProfileEditForm onDone={() => { returning.current = true; setEditing(false); }} />;
  return (
    <>
      <ModalBody>
        <div className="flex flex-col gap-6">
          <ProfileHeader identity={profileIdentity(profile)} profile={profile} onEdit={() => setEditing(true)} editRef={editButton} />
          <ProfileAccountCard onOpenLogin={openLogin} />
          <ProfileActivityCard />
        </div>
      </ModalBody>
      <ModalFooter><Button variant="secondary" onClick={onClose}>关闭</Button></ModalFooter>
    </>
  );
}
