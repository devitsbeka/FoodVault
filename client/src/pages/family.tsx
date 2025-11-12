import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Crown, UserPlus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Family, FamilyMember, User } from "@shared/schema";

type FamilyWithMembers = Family & {
  members: (FamilyMember & { user: User })[];
};

export default function FamilyPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: family, isLoading } = useQuery<FamilyWithMembers | null>({
    queryKey: ["/api/family"],
  });

  const createFamilyMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/family", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      setIsCreateDialogOpen(false);
      setFamilyName("");
      toast({
        title: "Family created",
        description: "Your family group has been created successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create family. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateFamily = () => {
    if (!familyName.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a family name.",
        variant: "destructive",
      });
      return;
    }
    createFamilyMutation.mutate(familyName);
  };

  const inviteMemberMutation = useMutation({
    mutationFn: async (email: string) => {
      return await apiRequest("POST", "/api/family/members", { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      toast({
        title: "Member added",
        description: "The user has been added to your family.",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      const errorMessage = error.message || "Failed to add member. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleInviteMember = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    inviteMemberMutation.mutate(inviteEmail.trim().toLowerCase());
  };

  const seedFamilyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/dev/seed-family", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      toast({
        title: "Test members added",
        description: data.message || "Test family members have been created.",
      });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      const errorMessage = error.message || "Failed to seed test members.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!family) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="p-12">
          <div className="text-center">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Family Group</h3>
            <p className="text-muted-foreground mb-6">
              Create a family group to collaborate on meal planning with your household
            </p>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-family">
                  <Users className="w-4 h-4 mr-2" />
                  Create Family Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Family Group</DialogTitle>
                  <DialogDescription>
                    Start collaborating on meals with your household
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="family-name">Family Name</Label>
                    <Input
                      id="family-name"
                      placeholder="e.g., The Smiths"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      data-testid="input-family-name"
                    />
                  </div>
                  <Button
                    onClick={handleCreateFamily}
                    className="w-full"
                    disabled={createFamilyMutation.isPending}
                    data-testid="button-submit-create-family"
                  >
                    {createFamilyMutation.isPending ? "Creating..." : "Create Family"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-large-title">{family.name}</h1>
          <p className="text-muted-foreground mt-1">
            {family.members.length} member{family.members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {import.meta.env.DEV && (
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => seedFamilyMutation.mutate()}
              disabled={seedFamilyMutation.isPending}
              data-testid="button-seed-family"
            >
              <Users className="w-4 h-4" />
              {seedFamilyMutation.isPending ? "Adding..." : "Seed Test Members"}
            </Button>
          )}
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-invite-member">
                <UserPlus className="w-4 h-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Family Member</DialogTitle>
                <DialogDescription>
                  Add an existing user to your family by entering their email address.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="member@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleInviteMember();
                      }
                    }}
                    data-testid="input-invite-email"
                  />
                </div>
                <Button
                  onClick={handleInviteMember}
                  className="w-full"
                  disabled={inviteMemberMutation.isPending}
                  data-testid="button-submit-invite"
                >
                  {inviteMemberMutation.isPending ? "Adding..." : "Add Member"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Family Members</CardTitle>
          <CardDescription>
            People who can collaborate on meal planning and voting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {family.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/30"
              data-testid={`member-${member.id}`}
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={member.user.profileImageUrl || undefined} />
                  <AvatarFallback>
                    {member.user.firstName?.[0]}{member.user.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {member.user.firstName} {member.user.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.user.email}
                  </p>
                </div>
              </div>
              {member.role === "admin" && (
                <Badge variant="secondary" className="gap-1">
                  <Crown className="w-3 h-3" />
                  Admin
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voting Settings</CardTitle>
          <CardDescription>
            Configure how meal planning votes are counted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Vote Threshold</p>
                <p className="text-sm text-muted-foreground">
                  Number of votes needed to approve a meal
                </p>
              </div>
              <Badge variant="outline" className="text-base px-4 py-2" data-testid="badge-vote-threshold">
                {family.voteThreshold || 2}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
