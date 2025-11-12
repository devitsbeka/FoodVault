import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Send, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ChatMessage } from "@shared/schema";

export function AIChatFAB() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
    enabled: isOpen,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", "/api/chat/messages", { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      setMessage("");
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
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message);
  };

  return (
    <>
      {/* Floating Action Button */}
      <Button
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
        onClick={() => setIsOpen(true)}
        data-testid="button-ai-chat"
      >
        <Sparkles className="w-6 h-6" />
      </Button>

      {/* Chat Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl h-[600px] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Kitchen Assistant</DialogTitle>
                  <DialogDescription>
                    Ask me anything about recipes and cooking
                  </DialogDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} data-testid="button-close-chat">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            {isLoading ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <Skeleton className="h-16 w-3/4 rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : !messages || messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Hi! How can I help you today?</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  I can help you find recipes, suggest meal ideas, create shopping lists, and answer your cooking questions.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-6 w-full max-w-md">
                  <Button
                    variant="outline"
                    className="text-left justify-start h-auto py-3 px-4"
                    onClick={() => setMessage("What can I make with chicken and rice?")}
                    data-testid="suggestion-chicken-rice"
                  >
                    <span className="text-sm">What can I make with chicken and rice?</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="text-left justify-start h-auto py-3 px-4"
                    onClick={() => setMessage("Suggest a healthy dinner")}
                    data-testid="suggestion-healthy-dinner"
                  >
                    <span className="text-sm">Suggest a healthy dinner</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="text-left justify-start h-auto py-3 px-4"
                    onClick={() => setMessage("Create a shopping list for pasta carbonara")}
                    data-testid="suggestion-shopping-list"
                  >
                    <span className="text-sm">Create a shopping list</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="text-left justify-start h-auto py-3 px-4"
                    onClick={() => setMessage("How do I make perfect scrambled eggs?")}
                    data-testid="suggestion-cooking-tips"
                  >
                    <span className="text-sm">Cooking tips</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <Card
                      className={`max-w-[80%] ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div className="p-3">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </Card>
                  </div>
                ))}
                {sendMutation.isPending && (
                  <div className="flex justify-start">
                    <Card className="bg-muted">
                      <div className="p-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="px-6 py-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Ask me anything..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={sendMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending}
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
