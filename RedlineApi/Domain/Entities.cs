// Entidades prontas para Entity Framework Core (C# 12 / .NET 8+)

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace Redline.Domain.Entities
{
    public enum UserRole
    {
        Buyer,
        Seller,
        StoreManager
    }

    public enum BuildStage
    {
        Original,
        [Display(Name = "Stage 1")] Stage1,
        [Display(Name = "Stage 2")] Stage2,
        [Display(Name = "Stage 3")] Stage3,
        [Display(Name = "Stage 4")] Stage4,
        [Display(Name = "Full Build")] FullBuild
    }

    public enum TransmissionType
    {
        Manual,
        [Display(Name = "Automático")] Automatico,
        Sequencial,
        DCT
    }

    public enum LeadStatus
    {
        Novo,
        [Display(Name = "Em atendimento")] EmAtendimento,
        Convertido,
        Perdido
    }

    // Fundação de tenancy (RF-01 / §4). Uma loja agrega vendedores, veículos e leads.
    public class Store
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public required string Name { get; set; }
        public required string Slug { get; set; }
        public required string City { get; set; }
        public string? LogoUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navegações
        public ICollection<User> Users { get; set; } = new List<User>();
        public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
        public ICollection<Lead> Leads { get; set; } = new List<Lead>();
    }

    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public required string Name { get; set; }
        public required string Email { get; set; }
        public UserRole Role { get; set; }
        public string? AvatarUrl { get; set; }
        public int MemberSince { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Tenancy — opcional (um Buyer pode não pertencer a loja alguma).
        public Guid? StoreId { get; set; }
        public Store? Store { get; set; }

        // Propriedades de Navegação
        public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
        public ICollection<Lead> AssignedLeads { get; set; } = new List<Lead>();
        public ICollection<Favorite> Favorites { get; set; } = new List<Favorite>();
    }

    // Favorito (Fase 6): relação N:N User↔Vehicle via join explícito (resolve D7).
    public class Favorite
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid UserId { get; set; }
        public User? User { get; set; }

        public Guid VehicleId { get; set; }
        public Vehicle? Vehicle { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // Classe auxiliar para mapear o JSONB do Entity Framework
    public class CustomSpecs
    {
        public List<string> Engine { get; set; } = new();
        public List<string> Suspension { get; set; } = new();
        public List<string> Interior { get; set; } = new();
        public bool HasDyno { get; set; }
        public int? ClaimedHp { get; set; }
    }

    public class Vehicle
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public required string Title { get; set; }
        public required string Brand { get; set; }
        public required string Model { get; set; }
        public int Year { get; set; }

        [Column(TypeName = "decimal(15,2)")]
        public decimal Price { get; set; }
        public int Mileage { get; set; }
        public TransmissionType Transmission { get; set; }
        public BuildStage Stage { get; set; }

        // Mapeando a lista de imagens para JSON no EF Core 8+ usando primitive collections
        public List<string> Images { get; set; } = new();

        public Guid SellerId { get; set; }
        public User? Seller { get; set; } // Propriedade de Navegação

        // Tenancy — obrigatório (todo anúncio pertence a uma loja).
        public Guid StoreId { get; set; }
        public Store? Store { get; set; }

        public required string Location { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Mapeando a classe CustomSpecs para a coluna JSONB
        // No DbContext (OnModelCreating), você usará: builder.Entity<Vehicle>().OwnsOne(v => v.CustomSpecs, cs => cs.ToJson());
        public CustomSpecs? CustomSpecs { get; set; }

        public int Views { get; set; }

        // Soft-delete (Fase 5 / §3.1). Arquivar um anúncio = IsActive=false (preserva o histórico
        // de leads — §4.4). A vitrine pública só lista IsActive=true; a aba Estoque vê todos.
        public bool IsActive { get; set; } = true;
    }

    public class Lead
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid VehicleId { get; set; }
        public Vehicle? Vehicle { get; set; } // Propriedade de Navegação

        public required string CustomerName { get; set; }
        public required string Message { get; set; }

        public Guid AssignedSellerId { get; set; }
        public User? AssignedSeller { get; set; } // Propriedade de Navegação

        // Tenancy — obrigatório (lead sempre nasce dentro de uma loja).
        public Guid StoreId { get; set; }
        public Store? Store { get; set; }

        public LeadStatus Status { get; set; } = LeadStatus.Novo;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
