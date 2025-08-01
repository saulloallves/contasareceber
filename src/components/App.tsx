function AppContent() {
  const { user, loading, profile } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [cnpjSelecionado, setCnpjSelecionado] = useState("");

  // Mapeia o usuário do Supabase para o formato esperado pelo Header/Layout
  const mappedUser = user
    ? {
        name: profile?.nome_completo || user.user_metadata?.name || user.email || "Usuário",
        email: profile?.email || user.email || '',
        role: profile?.nivel_permissao || user.user_metadata?.role || "Admin",
        id: user.id,
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url
      }
    : undefined;
}